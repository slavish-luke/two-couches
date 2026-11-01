import "server-only";
import { settleLimited, toSearchResult, type SearchResult } from "./titles";
import { tmdbGet, type MovieResult, type PagedResponse, type TvResult } from "./tmdb";

/**
 * Upcoming releases are throwaway like browse results, so they live in Next's fetch cache rather than
 * Supabase. Release dates change slowly, so they're kept for a day.
 */
const REVALIDATE = 6 * 60 * 60;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Today plus some days, as YYYY-MM-DD (UTC). */
function dateIn(days: number) {
  return new Date(Date.now() + days * DAY_MS).toISOString().slice(0, 10);
}

// TMDB's release types: 1 premiere, 2 limited theatrical, 3 theatrical, 4 digital, 5 physical, 6 TV.
const CINEMA_TYPES = [2, 3];
const DIGITAL_TYPES = [4];

async function discoverMovies(params: Record<string, string>, locale: string) {
  const data = await tmdbGet<PagedResponse<MovieResult>>(
    "/discover/movie",
    { ...params, language: locale, include_adult: "false", sort_by: "popularity.desc" },
    { revalidate: REVALIDATE },
  );
  return data.results.map((r) => toSearchResult({ media_type: "movie", ...r }));
}

/** Popular films that opened in a country's cinemas in the last four weeks or open in the next three months. */
export function cinemaReleases(region: string, locale: string): Promise<SearchResult[]> {
  return discoverMovies(
    {
      region,
      with_release_type: CINEMA_TYPES.join("|"),
      "release_date.gte": dateIn(-28),
      "release_date.lte": dateIn(90),
    },
    locale,
  );
}

/** Popular films released digitally (to stream, rent or buy) in a country in the next three months. */
export function digitalReleases(region: string, locale: string): Promise<SearchResult[]> {
  return discoverMovies(
    { region, with_release_type: DIGITAL_TYPES.join("|"), "release_date.gte": dateIn(0), "release_date.lte": dateIn(90) },
    locale,
  );
}

/** Popular series with an episode airing in the next two weeks, on any of these subscription services in a country. */
export async function newEpisodes(region: string, providers: number[], locale: string): Promise<SearchResult[]> {
  if (providers.length === 0) return [];
  const data = await tmdbGet<PagedResponse<TvResult>>(
    "/discover/tv",
    {
      watch_region: region,
      with_watch_providers: providers.join("|"),
      with_watch_monetization_types: "flatrate",
      "air_date.gte": dateIn(0),
      "air_date.lte": dateIn(14),
      language: locale,
      include_adult: "false",
      sort_by: "popularity.desc",
    },
    { revalidate: REVALIDATE },
  );
  return data.results.map((r) => toSearchResult({ media_type: "tv", ...r }));
}

type ReleaseDatesResponse = {
  results: { iso_3166_1: string; release_dates: { release_date: string; type: number }[] }[];
};

/** A film's cinema and digital release dates in one country, as YYYY-MM-DD. */
export type CountryReleases = { cinema: string | null; digital: string | null };

/**
 * Each film's release dates in each of these countries, by TMDB ID: the first since four weeks ago (so a
 * re-release beats the original), else the latest. Films TMDB couldn't be asked about are left out.
 */
export async function releaseDates(ids: number[], countries: string[]): Promise<Record<number, Record<string, CountryReleases>>> {
  const unique = [...new Set(ids)];
  const fetched = await settleLimited(unique, 10, (id) =>
    tmdbGet<ReleaseDatesResponse>(`/movie/${id}/release_dates`, {}, { revalidate: DAY_MS / 1000 }),
  );

  const since = dateIn(-28);
  const result: Record<number, Record<string, CountryReleases>> = {};
  fetched.forEach((outcome, i) => {
    if (outcome.status === "rejected") {
      console.error(`Loading release dates for movie ${unique[i]} failed`, outcome.reason);
      return;
    }
    result[unique[i]] = Object.fromEntries(
      countries.map((country) => {
        const dates = outcome.value.results.find((r) => r.iso_3166_1 === country)?.release_dates ?? [];
        const first = (types: number[]) => {
          const sorted = dates
            .filter((d) => types.includes(d.type))
            .map((d) => d.release_date.slice(0, 10))
            .sort();
          return sorted.find((d) => d >= since) ?? sorted.at(-1) ?? null;
        };
        return [country, { cinema: first(CINEMA_TYPES), digital: first(DIGITAL_TYPES) }];
      }),
    );
  });
  return result;
}

type TvNext = {
  next_episode_to_air: { air_date: string | null; season_number: number; episode_number: number } | null;
};

export type NextEpisode = { air_date: string; season: number; episode: number };

/** The next announced episode of each series, by TMDB ID. Series with none (or that failed to load) are left out. */
export async function nextEpisodes(ids: number[]): Promise<Record<number, NextEpisode>> {
  const unique = [...new Set(ids)];
  const fetched = await settleLimited(unique, 10, (id) => tmdbGet<TvNext>(`/tv/${id}`, {}, { revalidate: REVALIDATE }));

  const result: Record<number, NextEpisode> = {};
  fetched.forEach((outcome, i) => {
    if (outcome.status === "rejected") {
      console.error(`Loading the next episode of series ${unique[i]} failed`, outcome.reason);
      return;
    }
    const next = outcome.value.next_episode_to_air;
    if (next?.air_date) {
      result[unique[i]] = { air_date: next.air_date, season: next.season_number, episode: next.episode_number };
    }
  });
  return result;
}
