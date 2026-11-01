import "server-only";
import { isAlertKind, type AlertKind } from "./alert-rules";
import { createAdminClient } from "./supabase/admin";
import type { Json } from "./supabase/database.types";
import { createClient } from "./supabase/server";
import { getAvailability } from "./titles";
import { titleKey, type CountryAvailability, type MediaType, type TitleRef } from "./watch";

/** The subscription providers in one country's availability: all a snapshot keeps. */
export function flatrateIds(availability: CountryAvailability) {
  return availability.providers.filter((p) => p.kind === "flatrate").map((p) => p.provider_id);
}

/**
 * Records where a title streams today, when the couple starts watching for it (adds it to the list or
 * sets a reminder), so the daily check compares with today rather than counting it as already there.
 * Keeps any snapshot that exists. Never throws.
 */
export async function recordBaseline(ref: TitleRef, countries: string[]) {
  const admin = createAdminClient();
  if (!admin) return;
  try {
    const availability = (await getAvailability([ref], countries))[titleKey(ref)] ?? {};
    const rows = countries.flatMap((country) => {
      const there = availability[country];
      return there
        ? [{ media_type: ref.media_type, tmdb_id: ref.tmdb_id, country, provider_ids: flatrateIds(there) }]
        : [];
    });
    if (rows.length === 0) return;
    const { error } = await admin.from("availability_snapshots").upsert(rows, { ignoreDuplicates: true });
    if (error) throw error;
  } catch (error) {
    console.error(`Recording a baseline for ${titleKey(ref)} failed`, error);
  }
}

/** The title's name in the first of `locales` that's cached, else its original title. */
function pickTitle(texts: { locale: string; title: string }[], locales: string[], original: string) {
  return locales.map((l) => texts.find((t) => t.locale === l)).find(Boolean)?.title ?? original;
}

/** An alert's services column: provider names by profile ID. Anything malformed reads as nobody's. */
export function alertServices(value: Json): Record<string, string[]> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).map(([id, names]) => [
      id,
      Array.isArray(names) ? names.filter((n): n is string => typeof n === "string") : [],
    ]),
  );
}

export type Alert = TitleRef & {
  id: string;
  kind: AlertKind;
  /** The services each person can stream it on, by profile ID. */
  services: Record<string, string[]>;
  created_at: string;
  title: string;
  poster_path: string | null;
};

/** The couple's latest alerts, newest first. Named like getList(). */
export async function getAlerts(coupleId: string, locales: string[], limit = 12): Promise<Alert[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("alerts")
    .select("*, titles(original_title, poster_path, title_texts(locale, title))")
    .eq("couple_id", coupleId)
    .in("titles.title_texts.locale", locales)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;

  return data.flatMap((row) =>
    isAlertKind(row.kind)
      ? [
          {
            id: row.id,
            media_type: row.media_type as MediaType,
            tmdb_id: row.tmdb_id,
            kind: row.kind,
            services: alertServices(row.services),
            created_at: row.created_at,
            title: pickTitle(row.titles.title_texts, locales, row.titles.original_title),
            poster_path: row.titles.poster_path,
          },
        ]
      : [],
  );
}

/** How many of the couple's alerts arrived after `since` (the viewer's alerts_seen_at). */
export async function countNewAlerts(since: string) {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("alerts")
    .select("id", { count: "exact", head: true })
    .gt("created_at", since);
  if (error) console.error("Counting new alerts failed", error);
  return count ?? 0;
}

export type Reminder = TitleRef & {
  id: string;
  created_by: string | null;
  created_at: string;
  title: string;
  poster_path: string | null;
  release_date: string | null;
};

/** Titles the couple asked to hear about when they start streaming, newest first. */
export async function getReminders(coupleId: string, locales: string[]): Promise<Reminder[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("reminders")
    .select("*, titles(original_title, release_date, poster_path, title_texts(locale, title))")
    .eq("couple_id", coupleId)
    .in("titles.title_texts.locale", locales)
    .order("created_at", { ascending: false });
  if (error) throw error;

  return data.map((row) => ({
    id: row.id,
    media_type: row.media_type as MediaType,
    tmdb_id: row.tmdb_id,
    created_by: row.created_by,
    created_at: row.created_at,
    title: pickTitle(row.titles.title_texts, locales, row.titles.original_title),
    poster_path: row.titles.poster_path,
    release_date: row.titles.release_date,
  }));
}

/** titleKey() of every title the couple has a reminder for. */
export async function getReminderKeys(coupleId: string): Promise<Set<string>> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("reminders").select("media_type, tmdb_id").eq("couple_id", coupleId);
  if (error) throw error;
  return new Set(data.map((row) => titleKey(row as TitleRef)));
}
