import "server-only";
import { bestMatch } from "./import-rules";
import { toSearchResult, type SearchResult } from "./titles";
import { tmdbGet, type MovieResult, type PagedResponse, type TvResult } from "./tmdb";

// Finding a title on TMDB from what another app knows about it: an IMDb ID, or a film's name and year.
// Used by the import (Letterboxd and IMDb exports) and the share sheet (Sprint 18). Answers are kept a day
// in Next's fetch cache, so looking at the same file or link again doesn't ask TMDB again.

const REVALIDATE = 24 * 60 * 60;

type FindResponse = { movie_results: MovieResult[]; tv_results: TvResult[] };

/** The films and series TMDB has for an IMDb ID ("tt0133093"): usually one. */
export async function findByImdb(imdbId: string, locale: string): Promise<SearchResult[]> {
  const found = await tmdbGet<FindResponse>(
    `/find/${imdbId}`,
    { external_source: "imdb_id", language: locale },
    { revalidate: REVALIDATE },
  );
  return [
    ...found.movie_results.map((m) => toSearchResult({ ...m, media_type: "movie" })),
    ...found.tv_results.map((s) => toSearchResult({ ...s, media_type: "tv" })),
  ];
}

/**
 * The film best matching a name and year: TMDB's primary release year first (the year Letterboxd gives is
 * the film's own), then any release that year (festivals, other countries). An exact name wins over
 * TMDB's first result.
 */
export async function searchFilm(name: string, year: number | null, locale: string): Promise<SearchResult | null> {
  const tries: Record<string, string>[] = year ? [{ primary_release_year: String(year) }, { year: String(year) }] : [{}];
  for (const extra of tries) {
    const { results } = await tmdbGet<PagedResponse<MovieResult>>(
      "/search/movie",
      { query: name, language: locale, include_adult: "false", ...extra },
      { revalidate: REVALIDATE },
    );
    const best = bestMatch(
      name,
      year,
      results.slice(0, 10).map((movie) => ({
        movie,
        title: movie.title,
        original_title: movie.original_title,
        year: Number(movie.release_date?.slice(0, 4)) || null,
      })),
    );
    if (best) return toSearchResult({ ...best.movie, media_type: "movie" });
  }
  return null;
}
