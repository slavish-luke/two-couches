import "server-only";
import { getList } from "./list";
import { pickSeeds, scoreSuggestions, type Seed, type Suggestion } from "./recommend-rules";
import { createClient } from "./supabase/server";
import { settleLimited, toSearchResult, type SearchResult } from "./titles";
import { tmdbGet, type MovieResult, type PagedResponse, type TvResult } from "./tmdb";
import { titleKey, type MediaType, type TitleRef } from "./watch";

/** TMDB's recommendations change slowly, so they're kept in Next's fetch cache for a day, like search. */
const REVALIDATE = 24 * 60 * 60;

export type ForYouItem = Suggestion<SearchResult & { genre_ids: number[]; vote_average: number }>;

/** titleKey() of every title the couple said they're not interested in. */
export async function getDismissedKeys(coupleId: string): Promise<Set<string>> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("dismissed_titles").select("media_type, tmdb_id").eq("couple_id", coupleId);
  if (error) throw error;
  return new Set(data.map((row) => titleKey(row as TitleRef)));
}

/**
 * Films or series the couple might like, best first, from TMDB's recommendations for the titles on their
 * list (see seedWeight() and scoreSuggestions()). `seeds` is how many list titles counted in favour; with
 * none, there's nothing to go on. Throws when TMDB couldn't be reached for any of them.
 */
export async function getForYou(
  coupleId: string,
  type: MediaType,
  locales: string[],
  today: string,
): Promise<{ seeds: number; suggestions: ForYouItem[] }> {
  const [list, dismissed] = await Promise.all([getList(coupleId, locales), getDismissedKeys(coupleId)]);
  const seeds: Seed[] = pickSeeds(list.filter((item) => item.media_type === type));
  const likes = seeds.filter((s) => s.weight > 0).length;
  if (likes === 0) return { seeds: 0, suggestions: [] };

  const fetched = await settleLimited(seeds, 10, (seed) =>
    tmdbGet<PagedResponse<MovieResult | TvResult>>(
      `/${type}/${seed.tmdb_id}/recommendations`,
      { language: locales[0] },
      { revalidate: REVALIDATE },
    ),
  );
  if (fetched.every((f) => f.status === "rejected")) throw (fetched[0] as PromiseRejectedResult).reason;

  const sources = fetched.flatMap((outcome, i) => {
    if (outcome.status === "rejected") {
      console.error(`Loading recommendations for ${titleKey(seeds[i])} failed`, outcome.reason);
      return [];
    }
    const results = outcome.value.results.map((r) => ({
      ...toSearchResult(type === "movie" ? { media_type: "movie", ...(r as MovieResult) } : { media_type: "tv", ...(r as TvResult) }),
      genre_ids: r.genre_ids ?? [],
      vote_average: r.vote_average ?? 0,
    }));
    return [{ seed: seeds[i], results }];
  });
  const exclude = new Set([...list.map(titleKey), ...dismissed]);
  return { seeds: likes, suggestions: scoreSuggestions(sources, exclude, today) };
}
