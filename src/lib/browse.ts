import "server-only";
import { toSearchResult, type SearchResult } from "./titles";
import { tmdbGet, type GenreList, type MovieResult, type PagedResponse, type TvResult } from "./tmdb";
import type { MediaType } from "./watch";

/**
 * Discover and trending results are throwaway like search results, so they live in Next's fetch cache
 * rather than Supabase. What's streaming changes through the day, so they're kept for a few hours.
 */
const REVALIDATE = 6 * 60 * 60;

export const SORTS = ["popular", "rated", "newest"] as const;
export type Sort = (typeof SORTS)[number];

/** First year of each decade, plus everything before the oldest one. */
export const DECADES = ["2020", "2010", "2000", "1990", "1980", "older"] as const;
export type Decade = (typeof DECADES)[number];

export const MIN_RATINGS = ["6", "7", "8"] as const;
export type MinRating = (typeof MIN_RATINGS)[number];

export type DiscoverQuery = {
  type: MediaType;
  /** ISO country code: the TMDB watch region. */
  region: string;
  /** Subscription services to look on, any of them. Empty means anything streaming there. */
  providers: number[];
  genre: number | null;
  decade: Decade | null;
  minRating: MinRating | null;
  sort: Sort;
  /** TMDB's page, from 1. */
  page: number;
};

export type DiscoverPage = { results: SearchResult[]; totalPages: number };

/** TMDB serves at most this many pages of any discover query. */
export const MAX_PAGES = 500;

function withType(type: MediaType, results: (MovieResult | TvResult)[]) {
  return results.map((r) =>
    toSearchResult(type === "movie" ? { media_type: "movie", ...(r as MovieResult) } : { media_type: "tv", ...(r as TvResult) }),
  );
}

/** Films or series streaming in one country, filtered and sorted, in the viewer's locale. */
export async function discoverTitles(query: DiscoverQuery, locale: string): Promise<DiscoverPage> {
  const dateField = query.type === "movie" ? "primary_release_date" : "first_air_date";
  const today = new Date().toISOString().slice(0, 10);
  const params: Record<string, string> = {
    language: locale,
    watch_region: query.region,
    include_adult: "false",
    page: String(query.page),
    sort_by: { popular: "popularity.desc", rated: "vote_average.desc", newest: `${dateField}.desc` }[query.sort],
    // Unreleased titles can still be listed on a service; skip them.
    [`${dateField}.lte`]: today,
  };
  if (query.providers.length > 0) {
    params.with_watch_providers = query.providers.join("|");
    params.with_watch_monetization_types = "flatrate";
  } else {
    params.with_watch_monetization_types = "flatrate|free|ads";
  }
  if (query.genre) params.with_genres = String(query.genre);
  if (query.decade === "older") {
    params[`${dateField}.lte`] = `${Number(DECADES.at(-2)) - 1}-12-31`;
  } else if (query.decade) {
    const end = `${Number(query.decade) + 9}-12-31`;
    params[`${dateField}.gte`] = `${query.decade}-01-01`;
    if (end < today) params[`${dateField}.lte`] = end;
  }
  if (query.minRating) params["vote_average.gte"] = query.minRating;
  // A handful of votes makes for a meaningless average.
  if (query.sort === "rated") params["vote_count.gte"] = "200";
  else if (query.minRating) params["vote_count.gte"] = "50";

  const data = await tmdbGet<PagedResponse<MovieResult | TvResult>>(`/discover/${query.type}`, params, {
    revalidate: REVALIDATE,
  });
  return { results: withType(query.type, data.results), totalPages: Math.min(data.total_pages, MAX_PAGES) };
}

/** This week's most talked-about films or series worldwide. TMDB's trending isn't per country. */
export async function trendingTitles(type: MediaType, locale: string): Promise<SearchResult[]> {
  const data = await tmdbGet<PagedResponse<MovieResult | TvResult>>(
    `/trending/${type}/week`,
    { language: locale },
    { revalidate: REVALIDATE },
  );
  return withType(type, data.results);
}

/** TMDB's genres for films or series (the two lists differ), named in the viewer's language. */
export async function getGenres(type: MediaType, locale: string) {
  const data = await tmdbGet<GenreList>(`/genre/${type}/list`, { language: locale }, { revalidate: 24 * 60 * 60 });
  return data.genres.toSorted((a, b) => a.name.localeCompare(b.name, locale));
}
