import "server-only";
import { getMessages } from "./i18n";
import { getList } from "./list";
import { formatDay, formatTime, isNightMethod, UNDER_WAY_MS, type NightMethod } from "./night-rules";
import { sendPush } from "./push";
import { createAdminClient } from "./supabase/admin";
import type { Database } from "./supabase/database.types";
import { createClient } from "./supabase/server";
import { pickText } from "./titles";
import { tmdbLocale } from "./tmdb";
import { titleKey, type MediaType, type TitleRef } from "./watch";

type NightRow = Database["public"]["Tables"]["watch_nights"]["Row"];

export type WatchNight = Pick<
  NightRow,
  "id" | "starts_at" | "link" | "syncplay_server" | "syncplay_room" | "notes" | "created_by" | "created_at"
> & {
  method: NightMethod | null;
  /** What you'll watch, or null to decide later. */
  title: (TitleRef & { title: string; poster_path: string | null; runtime: number | null }) | null;
};

const SELECT = "*, titles(original_title, poster_path, runtime, title_texts(locale, title, poster_path))";

function toNight(
  row: NightRow & {
    titles: {
      original_title: string;
      poster_path: string | null;
      runtime: number | null;
      title_texts: { locale: string; title: string; poster_path: string | null }[];
    } | null;
  },
  locales: string[],
): WatchNight {
  return {
    id: row.id,
    starts_at: row.starts_at,
    method: isNightMethod(row.method) ? row.method : null,
    link: row.link,
    syncplay_server: row.syncplay_server,
    syncplay_room: row.syncplay_room,
    notes: row.notes,
    created_by: row.created_by,
    created_at: row.created_at,
    title:
      row.titles && row.media_type && row.tmdb_id
        ? {
            media_type: row.media_type as MediaType,
            tmdb_id: row.tmdb_id,
            ...pickText(row.titles.title_texts, locales, row.titles),
            runtime: row.titles.runtime,
          }
        : null,
  };
}

/**
 * The couple's watch nights. Upcoming ones (including any still under way) come soonest first; past ones
 * latest first. Titles are named like getList().
 */
export async function getWatchNights(
  coupleId: string,
  locales: string[],
  { past = false, limit = 50 }: { past?: boolean; limit?: number } = {},
): Promise<WatchNight[]> {
  const cutoff = new Date(Date.now() - UNDER_WAY_MS).toISOString();
  const supabase = await createClient();
  let query = supabase
    .from("watch_nights")
    .select(SELECT)
    .eq("couple_id", coupleId)
    .in("titles.title_texts.locale", locales);
  query = past ? query.lt("starts_at", cutoff) : query.gte("starts_at", cutoff);
  const { data, error } = await query.order("starts_at", { ascending: !past }).limit(limit);
  if (error) throw error;
  return data.map((row) => toNight(row, locales));
}

/** When each of the couple's watch nights starts (UTC), for the stats page. */
export async function getNightStarts(coupleId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("watch_nights").select("starts_at").eq("couple_id", coupleId);
  if (error) throw error;
  return data.map((row) => row.starts_at);
}

/** One of the couple's watch nights, or null if there's no such night (or it isn't theirs). */
export async function getWatchNight(id: string, locales: string[]): Promise<WatchNight | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("watch_nights")
    .select(SELECT)
    .eq("id", id)
    .in("titles.title_texts.locale", locales)
    .maybeSingle();
  if (error) throw error;
  return data && toNight(data, locales);
}

/** Titles to pick from when planning: the list's "Up next" (watching or want), A to Z, keyed by titleKey(). */
export async function titleOptions(coupleId: string, locales: string[]) {
  const list = await getList(coupleId, locales);
  return list
    .filter((item) => item.status === "watching" || item.status === "want")
    .map((item) => ({ key: titleKey(item), title: item.title }))
    .sort((a, b) => a.title.localeCompare(b.title, locales[0]));
}

export type NightChange = "planned" | "changed" | "cancelled";

/**
 * Tells the other member of the couple, on every device they've turned notifications on for, that a watch
 * night was planned, moved or cancelled: in their language, at their local time. Never throws.
 */
export async function notifyPartner(
  change: NightChange,
  night: { id: string; starts_at: string; title: TitleRef | null },
  by: { id: string; couple_id: string; display_name: string },
  contact: string,
) {
  const admin = createAdminClient();
  if (!admin) return;
  try {
    const { data: partner, error } = await admin
      .from("profiles")
      .select("id, language, country, time_zone, push_subscriptions(id, endpoint, p256dh, auth)")
      .eq("couple_id", by.couple_id)
      .neq("id", by.id)
      .maybeSingle();
    if (error) throw error;
    if (!partner || partner.push_subscriptions.length === 0) return;

    const t = getMessages(partner.language).nights;
    let name = t.push.noTitle;
    if (night.title) {
      const { data: title } = await admin
        .from("titles")
        .select("original_title, title_texts(locale, title)")
        .eq("media_type", night.title.media_type)
        .eq("tmdb_id", night.title.tmdb_id)
        .maybeSingle();
      const locale = partner.country ? tmdbLocale(partner.language, partner.country) : null;
      name = title?.title_texts.find((text) => text.locale === locale)?.title ?? title?.original_title ?? name;
    }
    const start = new Date(night.starts_at);
    const when = `${formatDay(start, partner.time_zone, partner.language)}, ${formatTime(start, partner.time_zone, partner.language)}`;
    const text = t.push[change];
    await sendPush(
      admin,
      partner.push_subscriptions,
      {
        title: text.heading,
        body: text.body(name, when, by.display_name || getMessages(partner.language).common.yourPartner),
        url: "/watch-nights",
        tag: `night-${night.id}`,
      },
      contact,
    );
  } catch (error) {
    console.error(`Telling the partner about watch night ${night.id} failed`, error);
  }
}
