import "server-only";
import type { ProviderKind } from "./watch";

const TMDB_API = "https://api.themoviedb.org/3";

export function isTmdbConfigured() {
  return Boolean(process.env.TMDB_API_TOKEN);
}

export class TmdbError extends Error {
  constructor(
    path: string,
    readonly status: number,
  ) {
    super(`TMDB ${path} responded ${status}`);
  }
}

/**
 * GET a TMDB v3 endpoint with the server-side read token. Never import this from client code.
 * Pass `revalidate` (seconds) to keep the response in Next's fetch cache; otherwise it isn't cached.
 */
export async function tmdbGet<T>(
  path: string,
  params: Record<string, string> = {},
  { revalidate }: { revalidate?: number } = {},
): Promise<T> {
  const token = process.env.TMDB_API_TOKEN;
  if (!token) throw new Error("TMDB_API_TOKEN is not set");

  const url = new URL(`${TMDB_API}${path}`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    ...(revalidate && { next: { revalidate } }),
  });
  if (!res.ok) throw new TmdbError(path, res.status);
  return res.json() as Promise<T>;
}

/** TMDB's language parameter for a viewer, e.g. "en-GB": their UI language and their country. */
export function tmdbLocale(language: string, country: string) {
  return `${language}-${country}`;
}

type WatchProviderList = {
  results: {
    provider_id: number;
    provider_name: string;
    logo_path: string | null;
    display_priority: number;
    display_priorities?: Record<string, number>;
  }[];
};

/** Every streaming service TMDB lists for a country, across movies and TV. */
export async function fetchWatchProviders(country: string) {
  const params = { watch_region: country, language: "en-US" };
  const [movie, tv] = await Promise.all([
    tmdbGet<WatchProviderList>("/watch/providers/movie", params),
    tmdbGet<WatchProviderList>("/watch/providers/tv", params),
  ]);

  const byId = new Map<number, { provider_id: number; name: string; logo_path: string | null; display_priority: number }>();
  for (const p of [...movie.results, ...tv.results]) {
    const priority = p.display_priorities?.[country] ?? p.display_priority;
    const existing = byId.get(p.provider_id);
    if (!existing || priority < existing.display_priority) {
      byId.set(p.provider_id, {
        provider_id: p.provider_id,
        name: p.provider_name,
        logo_path: p.logo_path,
        display_priority: priority,
      });
    }
  }
  return [...byId.values()];
}

/** A film in TMDB's search, discover and trending results. */
export type MovieResult = {
  id: number;
  title: string;
  original_title: string;
  release_date?: string;
  poster_path: string | null;
  overview: string;
  /** In discover, trending and recommendation results, not search. */
  genre_ids?: number[];
  vote_average?: number;
};

/** A series in TMDB's search, discover and trending results. */
export type TvResult = {
  id: number;
  name: string;
  original_name: string;
  first_air_date?: string;
  poster_path: string | null;
  overview: string;
  genre_ids?: number[];
  vote_average?: number;
};

export type SearchResponse = {
  results: (({ media_type: "movie" } & MovieResult) | ({ media_type: "tv" } & TvResult) | { media_type: "person"; id: number })[];
};

/** /discover/{movie|tv}, /trending/{movie|tv}/{window} and /{movie|tv}/{id}/recommendations. TMDB serves at most 500 pages. */
export type PagedResponse<T> = { page: number; total_pages: number; total_results: number; results: T[] };

export type GenreList = { genres: { id: number; name: string }[] };

type DetailsCommon = {
  id: number;
  original_language: string;
  overview: string;
  tagline: string | null;
  poster_path: string | null;
  backdrop_path: string | null;
  genres: { id: number; name: string }[];
  vote_average: number;
  videos?: {
    results: { key: string; site: string; type: string; official: boolean; iso_639_1: string }[];
  };
};

export type MovieDetails = DetailsCommon & {
  title: string;
  original_title: string;
  release_date: string;
  runtime: number | null;
};

export type TvDetails = DetailsCommon & {
  name: string;
  original_name: string;
  first_air_date: string;
  episode_run_time: number[];
  number_of_seasons: number;
};

export const PROVIDER_KINDS: ProviderKind[] = ["flatrate", "free", "ads", "rent", "buy"];

type ProviderEntry = { provider_id: number; provider_name: string; logo_path: string | null; display_priority: number };

/** /{movie|tv}/{id}/watch/providers: every country at once. */
export type TitleProviders = {
  results: Record<string, { link?: string } & Partial<Record<ProviderKind, ProviderEntry[]>>>;
};
