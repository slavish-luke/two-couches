import "server-only";
import {
  filmRating,
  seriesRating,
  type AgeRating,
  type ContentRatingsResults,
  type Keyword,
  type ReleaseDatesResults,
} from "./guidance-rules";
import { createClient } from "./supabase/server";
import { tmdbGet } from "./tmdb";
import type { TitleRef } from "./watch";

// Content guidance (Sprint 19): age ratings and keywords from TMDB, through the server with Next's fetch cache
// like browse (they change slowly), and each person's "Warn me about" list from Supabase.

const DAY = 24 * 60 * 60;

/** Each country's age rating for a title (null where TMDB has none). Throws when TMDB can't be asked. */
export async function getAgeRatings(ref: TitleRef, countries: string[]): Promise<Record<string, AgeRating | null>> {
  if (ref.media_type === "movie") {
    // The same request Coming soon's release dates make, so they share a cache entry.
    const data = await tmdbGet<ReleaseDatesResults>(`/movie/${ref.tmdb_id}/release_dates`, {}, { revalidate: DAY });
    return Object.fromEntries(countries.map((c) => [c, filmRating(data, c)]));
  }
  const data = await tmdbGet<ContentRatingsResults>(`/tv/${ref.tmdb_id}/content_ratings`, {}, { revalidate: DAY });
  return Object.fromEntries(countries.map((c) => [c, seriesRating(data, c)]));
}

/** The topics (TMDB keywords) a title is tagged with. Throws when TMDB can't be asked. */
export async function getTitleKeywords(ref: TitleRef): Promise<Keyword[]> {
  if (ref.media_type === "movie") {
    const data = await tmdbGet<{ keywords?: Keyword[] }>(`/movie/${ref.tmdb_id}/keywords`, {}, { revalidate: DAY });
    return data.keywords ?? [];
  }
  const data = await tmdbGet<{ results?: Keyword[] }>(`/tv/${ref.tmdb_id}/keywords`, {}, { revalidate: DAY });
  return data.results ?? [];
}

/** TMDB keywords matching a search, first page only. */
export async function searchKeywords(query: string): Promise<Keyword[]> {
  const data = await tmdbGet<{ results: Keyword[] }>(
    "/search/keyword",
    { query, page: "1" },
    { revalidate: 6 * 60 * 60 },
  );
  return data.results.slice(0, 12).map(({ id, name }) => ({ id, name }));
}

/** One TMDB keyword by ID (to store its real name), or null if TMDB doesn't know it. */
export async function getKeyword(id: number): Promise<Keyword | null> {
  try {
    const data = await tmdbGet<Keyword>(`/keyword/${id}`, {}, { revalidate: DAY });
    return { id: data.id, name: data.name };
  } catch {
    return null;
  }
}

/** Each member's "Warn me about" topics, by profile ID, oldest first. */
export async function getWarnKeywords(coupleId: string): Promise<Record<string, Keyword[]>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("warn_keywords")
    .select("profile_id, keyword_id, name")
    .eq("couple_id", coupleId)
    .order("created_at");
  if (error) throw error;
  const lists: Record<string, Keyword[]> = {};
  for (const row of data) (lists[row.profile_id] ??= []).push({ id: row.keyword_id, name: row.name });
  return lists;
}
