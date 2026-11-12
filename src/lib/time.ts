import "server-only";
import { addDays } from "./night-rules";
import { createClient } from "./supabase/server";
import type { ListStatus } from "./list-rules";
import type { FreeRow, TimelineEntry, TimelineNight } from "./time-rules";
import { getTitle, pickText, settleLimited } from "./titles";
import { PHOTO_BUCKET } from "./together-rules";
import { titleKey, type MediaType, type TitleRef } from "./watch";

// Sprint 22's queries. Everything runs as the signed-in user, so RLS keeps it to their couple.

/** The couple's "I'm free tonight" rows around today (any local date is within a day of the UTC one). */
export async function getFreeEvenings(coupleId: string, now = new Date()): Promise<FreeRow[]> {
  const supabase = await createClient();
  const utc = now.toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("free_evenings")
    .select("profile_id, on_day, free")
    .eq("couple_id", coupleId)
    .gte("on_day", addDays(utc, -1))
    .lte("on_day", addDays(utc, 1));
  if (error) {
    // Home still works without it.
    console.error("Loading free evenings failed", error);
    return [];
  }
  return data;
}

// ---------------------------------------------------------------------------------------------------------
// Origin countries
// ---------------------------------------------------------------------------------------------------------

/** At most this many titles get looked up on TMDB in one go to learn where they were made. */
const MAX_ORIGIN_LOOKUPS = 40;

/**
 * Each title's origin countries (titleKey() → codes), from the titles cache. Titles cached before Sprint 22
 * have none yet: up to MAX_ORIGIN_LOOKUPS of them are refreshed through getTitle(), which fills them in.
 * Titles still unknown are left out.
 */
export async function getOrigins(refs: TitleRef[], locale: string): Promise<Map<string, string[]>> {
  const origins = new Map<string, string[]>();
  if (refs.length === 0) return origins;
  const supabase = await createClient();
  const ids = [...new Set(refs.map((r) => r.tmdb_id))];
  const { data, error } = await supabase
    .from("titles")
    .select("media_type, tmdb_id, origin_countries")
    .in("tmdb_id", ids);
  if (error) {
    console.error("Loading origin countries failed", error);
    return origins;
  }
  const wanted = new Set(refs.map(titleKey));
  for (const row of data) {
    const key = titleKey(row as TitleRef);
    if (wanted.has(key) && row.origin_countries) origins.set(key, row.origin_countries);
  }
  const missing = [...new Map(refs.filter((r) => !origins.has(titleKey(r))).map((r) => [titleKey(r), r])).values()];
  const looked = await settleLimited(missing.slice(0, MAX_ORIGIN_LOOKUPS), 8, (ref) =>
    getTitle({ media_type: ref.media_type, tmdb_id: ref.tmdb_id }, locale),
  );
  looked.forEach((outcome, i) => {
    if (outcome.status === "fulfilled" && outcome.value?.origin_countries) {
      origins.set(titleKey(missing[i]), outcome.value.origin_countries);
    }
  });
  return origins;
}

// ---------------------------------------------------------------------------------------------------------
// All our nights
// ---------------------------------------------------------------------------------------------------------

/** A past night as the timeline shows it. */
export type PastNight = TimelineNight & {
  created_by: string | null;
  name: string | null;
  poster_path: string | null;
  /** Thumbnails of the album's first photos (storage paths, signed later), and how many there are. */
  thumbs: string[];
  photoCount: number;
};

/** How many of a night's photos the timeline shows. */
export const TIMELINE_THUMBS = 3;

/**
 * Every night of the couple's that has started by `now`, newest first, each in its planner's zone
 * (`zones` by profile ID, else `fallbackZone`), with its title in the first of `locales` cached.
 */
export async function getPastNights(
  coupleId: string,
  locales: string[],
  zones: Record<string, string>,
  fallbackZone: string,
  now = new Date(),
): Promise<PastNight[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("watch_nights")
    .select(
      "id, starts_at, created_by, media_type, tmdb_id, titles(original_title, poster_path, title_texts(locale, title, poster_path)), night_photos(thumb_path, created_at), photo_count:night_photos(count)",
    )
    .eq("couple_id", coupleId)
    .lte("starts_at", now.toISOString())
    .in("titles.title_texts.locale", locales)
    .order("starts_at", { ascending: false })
    .order("created_at", { referencedTable: "night_photos", ascending: true })
    .limit(TIMELINE_THUMBS, { referencedTable: "night_photos" });
  if (error) throw error;
  return data.map((row) => {
    const title: TitleRef | null =
      row.media_type && row.tmdb_id ? { media_type: row.media_type as MediaType, tmdb_id: row.tmdb_id } : null;
    const text = row.titles ? pickText(row.titles.title_texts, locales, row.titles) : null;
    const count = (row.photo_count as unknown as { count: number }[])[0]?.count ?? 0;
    return {
      id: row.id,
      starts_at: row.starts_at,
      created_by: row.created_by,
      zone: (row.created_by && zones[row.created_by]) || fallbackZone,
      title,
      name: text?.title ?? null,
      poster_path: text?.poster_path ?? null,
      thumbs: row.night_photos.map((p) => p.thumb_path),
      photoCount: count,
    };
  });
}

/** The list as the timeline needs it: titles, status, date watched, both ratings and every rewatch's. */
export async function getTimelineEntries(coupleId: string): Promise<TimelineEntry[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("list_items")
    .select(
      "id, media_type, tmdb_id, status, watched_on, list_ratings(profile_id, rating), titles(genre_ids), rewatches(watched_on, rewatch_ratings(profile_id, rating))",
    )
    .eq("couple_id", coupleId);
  if (error) throw error;
  return data.map((row) => ({
    id: row.id,
    media_type: row.media_type as MediaType,
    tmdb_id: row.tmdb_id,
    status: row.status as ListStatus,
    watched_on: row.watched_on,
    genre_ids: row.titles.genre_ids,
    ratings: Object.fromEntries(row.list_ratings.map((r) => [r.profile_id, r.rating])),
    rewatches: row.rewatches.map((r) => ({
      watched_on: r.watched_on,
      ratings: Object.fromEntries(r.rewatch_ratings.map((x) => [x.profile_id, x.rating])),
    })),
  }));
}

/** Signed links (an hour) to these album thumbnails, by path. Never public links: the bucket is private. */
export async function signThumbs(paths: string[]): Promise<Map<string, string>> {
  const signed = new Map<string, string>();
  if (paths.length === 0) return signed;
  const supabase = await createClient();
  const { data, error } = await supabase.storage.from(PHOTO_BUCKET).createSignedUrls(paths, 60 * 60);
  if (error) {
    console.error("Signing album thumbnails failed", error);
    return signed;
  }
  for (const item of data) if (item.path && item.signedUrl) signed.set(item.path, item.signedUrl);
  return signed;
}
