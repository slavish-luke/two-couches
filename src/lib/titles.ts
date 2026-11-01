import "server-only";
import type { Database } from "./supabase/database.types";
import { createAdminClient } from "./supabase/admin";
import { createClient } from "./supabase/server";
import {
  isTmdbConfigured,
  PROVIDER_KINDS,
  tmdbGet,
  TmdbError,
  type MovieDetails,
  type MovieResult,
  type SearchResponse,
  type TitleProviders,
  type TvDetails,
  type TvResult,
} from "./tmdb";
import { titleKey, type Availability, type MediaType, type Provider, type TitleRef } from "./watch";

const MAX_AGE_MS = 24 * 60 * 60 * 1000;

function isFresh(refreshedAt: string) {
  return Date.now() - Date.parse(refreshedAt) < MAX_AGE_MS;
}

/** Like Promise.allSettled over `items.map(fn)`, with at most `limit` calls in flight. TMDB rate-limits bursts. */
async function settleLimited<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>) {
  const results: PromiseSettledResult<R>[] = [];
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      try {
        results[i] = { status: "fulfilled", value: await fn(items[i]) };
      } catch (reason) {
        results[i] = { status: "rejected", reason };
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

function dateOrNull(value: string | undefined) {
  return value ? value : null;
}

export type SearchResult = TitleRef & {
  title: string;
  original_title: string;
  release_date: string | null;
  poster_path: string | null;
  overview: string;
};

/** A film or series from TMDB's search, discover or trending results, in our shape. */
export function toSearchResult(
  item: ({ media_type: "movie" } & MovieResult) | ({ media_type: "tv" } & TvResult),
): SearchResult {
  return item.media_type === "movie"
    ? {
        media_type: "movie",
        tmdb_id: item.id,
        title: item.title,
        original_title: item.original_title,
        release_date: dateOrNull(item.release_date),
        poster_path: item.poster_path,
        overview: item.overview,
      }
    : {
        media_type: "tv",
        tmdb_id: item.id,
        title: item.name,
        original_title: item.original_name,
        release_date: dateOrNull(item.first_air_date),
        poster_path: item.poster_path,
        overview: item.overview,
      };
}

/**
 * Films and series matching a query, in the viewer's locale. Search results are throwaway, so they're
 * kept in Next's fetch cache for a day rather than in Supabase.
 */
export async function searchTitles(query: string, locale: string): Promise<SearchResult[]> {
  const data = await tmdbGet<SearchResponse>(
    "/search/multi",
    { query, language: locale, include_adult: "false" },
    { revalidate: MAX_AGE_MS / 1000 },
  );
  return data.results.flatMap((r) => (r.media_type === "person" ? [] : [toSearchResult(r)]));
}

type TitleRow = Database["public"]["Tables"]["titles"]["Row"];
type TitleTextRow = Database["public"]["Tables"]["title_texts"]["Row"];

export type Title = TitleRef &
  Omit<TitleRow, "media_type" | "refreshed_at"> &
  Pick<TitleTextRow, "title" | "overview" | "tagline" | "genres" | "trailer_key">;

function toTitle(row: TitleRow, text: TitleTextRow): Title {
  return {
    ...row,
    media_type: row.media_type as MediaType,
    title: text.title,
    overview: text.overview,
    tagline: text.tagline,
    genres: text.genres,
    trailer_key: text.trailer_key,
  };
}

/** The best YouTube trailer: trailers over teasers, the viewer's language, then official ones. */
function pickTrailer(videos: MovieDetails["videos"], language: string) {
  const score = (v: { type: string; iso_639_1: string; official: boolean }) =>
    (v.type === "Trailer" ? 4 : 0) + (v.iso_639_1 === language ? 2 : 0) + (v.official ? 1 : 0);
  const candidates = (videos?.results ?? []).filter(
    (v) => v.site === "YouTube" && (v.type === "Trailer" || v.type === "Teaser"),
  );
  return candidates.sort((a, b) => score(b) - score(a))[0]?.key ?? null;
}

/**
 * A film or series in the viewer's locale (e.g. "en-GB"), or null if TMDB doesn't know it.
 * Served from the Supabase cache and refreshed from TMDB when older than a day.
 */
export async function getTitle(ref: TitleRef, locale: string): Promise<Title | null> {
  const supabase = await createClient();
  const { data: cached } = await supabase
    .from("titles")
    .select("*, title_texts(*)")
    .eq("media_type", ref.media_type)
    .eq("tmdb_id", ref.tmdb_id)
    .eq("title_texts.locale", locale)
    .maybeSingle();
  const cachedText = cached?.title_texts[0];
  if (cached && cachedText && isFresh(cached.refreshed_at) && isFresh(cachedText.refreshed_at)) {
    return toTitle(cached, cachedText);
  }

  let details: MovieDetails | TvDetails;
  try {
    details = await tmdbGet<MovieDetails | TvDetails>(`/${ref.media_type}/${ref.tmdb_id}`, {
      language: locale,
      append_to_response: "videos",
      include_video_language: `${locale.slice(0, 2)},en,null`,
    });
  } catch (error) {
    if (error instanceof TmdbError && error.status === 404) return null;
    if (cached && cachedText) {
      console.error(`Refreshing ${titleKey(ref)} from TMDB failed`, error);
      return toTitle(cached, cachedText);
    }
    throw error;
  }

  const refreshedAt = new Date().toISOString();
  const kind =
    "title" in details
      ? {
          title: details.title,
          original_title: details.original_title,
          release_date: details.release_date,
          runtime: details.runtime,
          seasons: null,
        }
      : {
          title: details.name,
          original_title: details.original_name,
          release_date: details.first_air_date,
          runtime: details.episode_run_time[0],
          seasons: details.number_of_seasons,
        };
  const row: TitleRow = {
    media_type: ref.media_type,
    tmdb_id: ref.tmdb_id,
    original_title: kind.original_title,
    original_language: details.original_language || null,
    release_date: dateOrNull(kind.release_date),
    poster_path: details.poster_path,
    backdrop_path: details.backdrop_path,
    genre_ids: details.genres.map((g) => g.id),
    runtime: kind.runtime || null,
    seasons: kind.seasons,
    vote_average: details.vote_average || null,
    refreshed_at: refreshedAt,
  };
  const text: TitleTextRow = {
    media_type: ref.media_type,
    tmdb_id: ref.tmdb_id,
    locale,
    title: kind.title,
    overview: details.overview ?? "",
    tagline: details.tagline ?? "",
    genres: details.genres.map((g) => g.name),
    trailer_key: pickTrailer(details.videos, locale.slice(0, 2)),
    refreshed_at: refreshedAt,
  };

  const admin = createAdminClient();
  if (admin) {
    const { error } = await admin.from("titles").upsert(row);
    const { error: textError } = error ? { error: null } : await admin.from("title_texts").upsert(text);
    if (error || textError) console.error(`Caching ${titleKey(ref)} failed`, error ?? textError);
  }
  return toTitle(row, text);
}

/**
 * Where each title can be watched in each country, keyed by titleKey(). Served from the Supabase cache
 * and refreshed from TMDB when older than a day. One TMDB call per stale title covers every country.
 * Never throws: titles that can't be checked come back with the countries missing.
 */
export async function getAvailability(titles: TitleRef[], countries: string[]): Promise<Record<string, Availability>> {
  // A title twice in one upsert would fail it.
  const refs = [...new Map(titles.map((ref) => [titleKey(ref), ref])).values()];
  const result: Record<string, Availability> = Object.fromEntries(refs.map((ref) => [titleKey(ref), {}]));
  if (refs.length === 0 || countries.length === 0) return result;

  const supabase = await createClient();
  const mediaTypes = [...new Set(refs.map((r) => r.media_type))];
  const ids = [...new Set(refs.map((r) => r.tmdb_id))];
  const [{ data: checks }, { data: rows }] = await Promise.all([
    supabase
      .from("availability_checks")
      .select("*")
      .in("media_type", mediaTypes)
      .in("tmdb_id", ids)
      .in("country", countries),
    supabase
      .from("availability")
      .select("*")
      .in("media_type", mediaTypes)
      .in("tmdb_id", ids)
      .in("country", countries)
      .order("display_priority"),
  ]);

  // Start from the cache. The query is a superset (any type × any id), so match keys exactly.
  for (const check of checks ?? []) {
    const byCountry = result[titleKey(check as TitleRef)];
    if (byCountry) byCountry[check.country] = { providers: [], link: check.link, checked_at: check.checked_at };
  }
  for (const row of rows ?? []) {
    result[titleKey(row as TitleRef)]?.[row.country]?.providers.push({
      provider_id: row.provider_id,
      name: row.provider_name,
      logo_path: row.logo_path,
      kind: row.kind as Provider["kind"],
      display_priority: row.display_priority,
    });
  }

  const stale = refs.filter((ref) =>
    countries.some((country) => {
      const checked = result[titleKey(ref)][country];
      return !checked || !isFresh(checked.checked_at);
    }),
  );
  if (stale.length === 0 || !isTmdbConfigured()) return result;

  const checkedAt = new Date().toISOString();
  const fetched = await settleLimited(stale, 20, (ref) =>
    tmdbGet<TitleProviders>(`/${ref.media_type}/${ref.tmdb_id}/watch/providers`),
  );

  const refreshed: TitleRef[] = [];
  const newChecks: Database["public"]["Tables"]["availability_checks"]["Insert"][] = [];
  const newRows: Database["public"]["Tables"]["availability"]["Insert"][] = [];
  fetched.forEach((outcome, i) => {
    const ref = stale[i];
    if (outcome.status === "rejected") {
      console.error(`Checking where to watch ${titleKey(ref)} failed`, outcome.reason);
      return;
    }
    refreshed.push(ref);
    // Only the key: refs may be whole search results with extra fields.
    const key = { media_type: ref.media_type, tmdb_id: ref.tmdb_id };
    for (const country of countries) {
      const offers = outcome.value.results[country];
      const providers = PROVIDER_KINDS.flatMap((kind) =>
        (offers?.[kind] ?? []).map((p) => ({
          provider_id: p.provider_id,
          name: p.provider_name,
          logo_path: p.logo_path,
          kind,
          display_priority: p.display_priority,
        })),
      ).sort((a, b) => a.display_priority - b.display_priority);

      result[titleKey(ref)][country] = { providers, link: offers?.link ?? null, checked_at: checkedAt };
      newChecks.push({ ...key, country, link: offers?.link ?? null, checked_at: checkedAt });
      newRows.push(
        ...providers.map((p) => ({
          ...key,
          country,
          provider_id: p.provider_id,
          kind: p.kind,
          provider_name: p.name,
          logo_path: p.logo_path,
          display_priority: p.display_priority,
        })),
      );
    }
  });

  const admin = createAdminClient();
  if (admin && refreshed.length > 0) {
    try {
      // Replace the previous snapshot for these titles and countries.
      const deletes = await Promise.all(
        refreshed.map((ref) =>
          admin
            .from("availability")
            .delete()
            .eq("media_type", ref.media_type)
            .eq("tmdb_id", ref.tmdb_id)
            .in("country", countries),
        ),
      );
      const deleteError = deletes.find((d) => d.error)?.error;
      if (deleteError) throw deleteError;
      if (newRows.length > 0) {
        const { error } = await admin.from("availability").upsert(newRows);
        if (error) throw error;
      }
      const { error } = await admin.from("availability_checks").upsert(newChecks);
      if (error) throw error;
    } catch (error) {
      console.error("Caching availability failed", error);
    }
  }
  return result;
}
