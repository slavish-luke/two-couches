import "server-only";
import type { EpisodeGuide, Rewatch, SeasonRatings } from "./diary-rules";
import { createClient } from "./supabase/server";
import { pickText, seasonEpisodes, settleLimited } from "./titles";
import { tmdbGet } from "./tmdb";

// Queries for Sprint 18's diary. They run as the signed-in user, so RLS limits them to their couple.

type RewatchRow = {
  id: string;
  list_item_id: string;
  watched_on: string;
  added_by: string | null;
  created_at: string;
  rewatch_ratings: { profile_id: string; rating: number }[];
};

function toRewatch(row: RewatchRow): Rewatch {
  return {
    id: row.id,
    list_item_id: row.list_item_id,
    watched_on: row.watched_on,
    added_by: row.added_by,
    created_at: row.created_at,
    ratings: Object.fromEntries(row.rewatch_ratings.map((r) => [r.profile_id, r.rating])),
  };
}

const REWATCH_COLUMNS = "id, list_item_id, watched_on, added_by, created_at, rewatch_ratings(profile_id, rating)";

/** One list item's rewatches (oldest first) and both people's season ratings. */
export async function getDiary(listItemId: string): Promise<{ rewatches: Rewatch[]; seasons: SeasonRatings }> {
  const supabase = await createClient();
  const [rewatches, seasons] = await Promise.all([
    supabase.from("rewatches").select(REWATCH_COLUMNS).eq("list_item_id", listItemId).order("watched_on"),
    supabase.from("season_ratings").select("season, profile_id, rating").eq("list_item_id", listItemId),
  ]);
  if (rewatches.error) throw rewatches.error;
  if (seasons.error) throw seasons.error;
  const bySeason: SeasonRatings = {};
  for (const row of seasons.data) (bySeason[row.season] ??= {})[row.profile_id] = row.rating;
  return { rewatches: rewatches.data.map(toRewatch), seasons: bySeason };
}

/** Every rewatch on the couple's list, oldest first (Stats and the export). */
export async function getRewatches(coupleId: string): Promise<Rewatch[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("rewatches")
    .select(REWATCH_COLUMNS)
    .eq("couple_id", coupleId)
    .order("watched_on");
  if (error) throw error;
  return data.map(toRewatch);
}

/** Every season rating on the couple's list (the export). */
export async function getSeasonRatings(coupleId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("season_ratings")
    .select("list_item_id, season, profile_id, rating")
    .eq("couple_id", coupleId)
    .order("season");
  if (error) throw error;
  return data;
}

/** The series the couple is watching, with their progress, named in the first of `locales` that's cached. */
export async function getWatchingSeries(coupleId: string, locales: string[]) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("list_items")
    .select("id, tmdb_id, season, episode, updated_at, titles(original_title, poster_path, title_texts(locale, title, poster_path))")
    .eq("couple_id", coupleId)
    .eq("media_type", "tv")
    .eq("status", "watching")
    .in("titles.title_texts.locale", locales);
  if (error) throw error;
  return data.map((row) => ({
    id: row.id,
    media_type: "tv" as const,
    tmdb_id: row.tmdb_id,
    progress: row.season && row.episode ? { season: row.season, episode: row.episode } : null,
    updated_at: row.updated_at,
    ...pickText(row.titles.title_texts, locales, row.titles),
  }));
}

type TmdbEpisode ={ air_date: string | null; season_number: number; episode_number: number } | null;

type TvEpisodes = {
  last_episode_to_air?: TmdbEpisode;
  next_episode_to_air?: TmdbEpisode;
  seasons?: { season_number: number; episode_count: number }[];
};

/** Like Coming soon's next episodes (the same URL, so the same fetch cache entry). */
const GUIDE_REVALIDATE = 6 * 60 * 60;

function toAired(episode: TmdbEpisode | undefined) {
  return episode ? { season: episode.season_number, episode: episode.episode_number, air_date: episode.air_date } : null;
}

/**
 * The last aired and next announced episode of each series, with episodes per season, by TMDB ID, from
 * TMDB's series details in Next's fetch cache (6 h). Series that fail to load are left out. Never throws.
 */
export async function getEpisodeGuides(ids: number[]): Promise<Record<number, EpisodeGuide>> {
  const unique = [...new Set(ids)];
  const fetched = await settleLimited(unique, 10, (id) => tmdbGet<TvEpisodes>(`/tv/${id}`, {}, { revalidate: GUIDE_REVALIDATE }));
  const result: Record<number, EpisodeGuide> = {};
  fetched.forEach((outcome, i) => {
    if (outcome.status === "rejected") {
      console.error(`Loading the episodes of series ${unique[i]} failed`, outcome.reason);
      return;
    }
    result[unique[i]] = {
      seasonEpisodes: seasonEpisodes(outcome.value.seasons),
      lastAired: toAired(outcome.value.last_episode_to_air),
      nextToAir: toAired(outcome.value.next_episode_to_air),
    };
  });
  return result;
}
