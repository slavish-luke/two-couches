"use server";

import { recordBaseline } from "@/lib/alerts";
import { getI18n } from "@/lib/i18n/server";
import { IMPORT_BATCH, MATCH_BATCH, type ImportItem, type MatchQuery, type MatchResult } from "@/lib/import-rules";
import { cacheForCouple, coupleCountries, getListKeys } from "@/lib/list";
import { isDateString, localDate } from "@/lib/list-rules";
import { requireCoupleProfile } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { findByImdb, searchFilm } from "@/lib/lookup";
import { getAvailability, settleLimited, type SearchResult } from "@/lib/titles";
import { tmdbLocale } from "@/lib/tmdb";
import { isMediaType, titleKey, type TitleRef } from "@/lib/watch";

// "Bring in your history" (Sprint 18). The browser reads the export files and sends the titles here in
// batches: first to be looked up on TMDB (a preview), then, once confirmed, to be added. Runs as the
// signed-in user, so RLS limits it to their couple's list.

/** TMDB calls in flight at once, like getAvailability(). */
const TMDB_PARALLEL = 20;

const IMDB_ID = /^tt\d{5,10}$/;

type Found = TitleRef & { title: string; year: string | null; poster_path: string | null };

function found(result: SearchResult): Found {
  return {
    media_type: result.media_type,
    tmdb_id: result.tmdb_id,
    title: result.title,
    year: result.release_date?.slice(0, 4) ?? null,
    poster_path: result.poster_path,
  };
}

function isQuery(value: unknown): value is MatchQuery {
  if (typeof value !== "object" || value === null) return false;
  const q = value as Record<string, unknown>;
  return (
    typeof q.key === "string" &&
    q.key.length <= 300 &&
    typeof q.name === "string" &&
    q.name.length <= 300 &&
    (q.year === null || Number.isInteger(q.year)) &&
    (q.imdb === null || (typeof q.imdb === "string" && IMDB_ID.test(q.imdb))) &&
    (q.type === null || isMediaType(q.type))
  );
}

/** One title on TMDB: by IMDb ID when there is one (a series first when IMDb says so), else a film by name and year. */
async function lookUp(query: MatchQuery, locale: string): Promise<Found | null> {
  if (query.imdb) {
    const results = await findByImdb(query.imdb, locale);
    const best = results.find((r) => r.media_type === query.type) ?? results.find((r) => r.media_type === "movie") ?? results[0];
    return best ? found(best) : null;
  }
  const film = await searchFilm(query.name, query.year, locale);
  return film && found(film);
}

/**
 * Looks up a batch of titles from an export (at most MATCH_BATCH), saying which are already on the list.
 * Titles TMDB doesn't know come back with no match.
 */
export async function matchImport(queries: MatchQuery[]): Promise<{ results: MatchResult[] } | { error: string }> {
  const profile = await requireCoupleProfile();
  const { t } = await getI18n();
  if (!Array.isArray(queries) || queries.length > MATCH_BATCH || !queries.every(isQuery)) {
    return { error: t.diary.import.errors.failed };
  }
  const locale = tmdbLocale(profile.language, profile.home_country);
  const [found, onList] = await Promise.all([
    settleLimited(queries, TMDB_PARALLEL, (q) => lookUp(q, locale)),
    getListKeys(profile.couple_id),
  ]);
  if (queries.length > 0 && found.every((f) => f.status === "rejected")) {
    console.error("Looking up an import failed", (found[0] as PromiseRejectedResult).reason);
    return { error: t.diary.import.errors.failed };
  }
  return {
    results: queries.map((q, i) => {
      const outcome = found[i];
      const match = outcome.status === "fulfilled" ? outcome.value : null;
      return { key: q.key, match: match && { ...match, onList: onList.has(titleKey(match)) } };
    }),
  };
}

function isImportItem(value: unknown, today: string): value is ImportItem {
  if (typeof value !== "object" || value === null) return false;
  const item = value as Record<string, unknown>;
  return (
    isMediaType(item.media_type) &&
    Number.isSafeInteger(item.tmdb_id) &&
    (item.tmdb_id as number) > 0 &&
    (item.status === "want" || item.status === "watched") &&
    (item.rating === null || (Number.isInteger(item.rating) && (item.rating as number) >= 1 && (item.rating as number) <= 5)) &&
    (item.watchedOn === null || (isDateString(item.watchedOn) && item.watchedOn <= today))
  );
}

/**
 * Adds a batch of confirmed titles (at most IMPORT_BATCH): cached in both partners' languages first, Up next
 * or Watched with the importer's own rating, and a baseline for the daily check on the Up next ones. Titles
 * already on the list (perhaps added on the other screen meanwhile) are left as they are.
 */
export async function importTitles(items: ImportItem[]): Promise<{ added: number; failed: number } | { error: string }> {
  const profile = await requireCoupleProfile();
  const { t } = await getI18n();
  const today = localDate(profile.time_zone);
  if (!Array.isArray(items) || items.length > IMPORT_BATCH || !items.every((item) => isImportItem(item, today))) {
    return { error: t.diary.import.errors.failed };
  }

  const cached = await settleLimited(items, 8, (item) => cacheForCouple({ media_type: item.media_type, tmdb_id: item.tmdb_id }, profile));
  const ready = items.filter((_, i) => cached[i].status === "fulfilled" && (cached[i] as PromiseFulfilledResult<string | null>).value === null);

  const supabase = await createClient();
  const { data: inserted, error } = await supabase
    .from("list_items")
    .upsert(
      ready.map((item) => ({
        couple_id: profile.couple_id,
        media_type: item.media_type,
        tmdb_id: item.tmdb_id,
        added_by: profile.id,
        status: item.status,
        watched_on: item.status === "watched" ? item.watchedOn : null,
      })),
      { onConflict: "couple_id,media_type,tmdb_id", ignoreDuplicates: true },
    )
    .select("id, media_type, tmdb_id");
  if (error) {
    console.error("Importing titles failed", error);
    return { error: t.title.errors.addFailed };
  }

  const added = new Map(inserted.map((row) => [titleKey(row as TitleRef), row.id]));
  const ratings = ready.flatMap((item) => {
    const id = added.get(titleKey(item));
    return id && item.rating ? [{ list_item_id: id, couple_id: profile.couple_id, profile_id: profile.id, rating: item.rating }] : [];
  });
  const upNext = ready.filter((item) => item.status === "want" && added.has(titleKey(item))).map(({ media_type, tmdb_id }) => ({ media_type, tmdb_id }));
  const countries = await coupleCountries(profile);
  await Promise.all([
    ratings.length
      ? supabase.from("list_ratings").insert(ratings).then(({ error: ratingError }) => ratingError && console.error("Importing ratings failed", ratingError))
      : null,
    // Like adding one by one: the daily check compares Up next titles with where they stream today. One
    // batch fills the availability cache, then each baseline reads it.
    upNext.length
      ? getAvailability(upNext, countries).then(() => settleLimited(upNext, 5, (ref) => recordBaseline(ref, countries)))
      : null,
  ]);
  return { added: added.size, failed: items.length - ready.length };
}
