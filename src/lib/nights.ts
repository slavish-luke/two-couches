import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getMessages } from "./i18n";
import { getList } from "./list";
import { formatDay, formatTime, isNightMethod, UNDER_WAY_MS, type NightMethod } from "./night-rules";
import type { ProposalStatus } from "./planning-rules";
import { sendPush } from "./push";
import { createAdminClient } from "./supabase/admin";
import type { Database } from "./supabase/database.types";
import { createClient } from "./supabase/server";
import type { ReadyCheck } from "./ready-rules";
import { pickText } from "./titles";
import { tmdbLocale } from "./tmdb";
import { titleKey, type MediaType, type TitleRef } from "./watch";

type NightRow = Database["public"]["Tables"]["watch_nights"]["Row"];

export type PrepItem = Pick<
  Database["public"]["Tables"]["night_prep_items"]["Row"],
  "id" | "label" | "done_at" | "done_by" | "added_by" | "created_at"
>;

/** A title as a night or proposal shows it, in the viewer's locale where cached. */
export type NightTitle = TitleRef & { title: string; poster_path: string | null; runtime: number | null };

export type WatchNight = Pick<
  NightRow,
  "id" | "starts_at" | "link" | "syncplay_server" | "syncplay_room" | "notes" | "created_by" | "created_at"
> & {
  method: NightMethod | null;
  /** What you'll watch, or null to decide later. */
  title: NightTitle | null;
  /** Each person's ready check, if they've started one. */
  checks: ReadyCheck[];
  /** The shared prep checklist, oldest first. */
  prep: PrepItem[];
};

type TitleJoin = {
  original_title: string;
  poster_path: string | null;
  runtime: number | null;
  title_texts: { locale: string; title: string; poster_path: string | null }[];
} | null;

const TITLE_SELECT = "titles(original_title, poster_path, runtime, title_texts(locale, title, poster_path))";

const SELECT = `*, ${TITLE_SELECT}, ready_checks(profile_id, ready_at, file_label, file_seconds), night_prep_items(id, label, done_at, done_by, added_by, created_at)`;

function toTitle(row: { media_type: string | null; tmdb_id: number | null; titles: TitleJoin }, locales: string[]) {
  return row.titles && row.media_type && row.tmdb_id
    ? {
        media_type: row.media_type as MediaType,
        tmdb_id: row.tmdb_id,
        ...pickText(row.titles.title_texts, locales, row.titles),
        runtime: row.titles.runtime,
      }
    : null;
}

function toNight(
  row: NightRow & { titles: TitleJoin; ready_checks: ReadyCheck[]; night_prep_items: PrepItem[] },
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
    title: toTitle(row, locales),
    checks: row.ready_checks,
    prep: row.night_prep_items.toSorted((a, b) => a.created_at.localeCompare(b.created_at)),
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

export type NightProposal = {
  id: string;
  proposed_by: string;
  /** The times to pick from (UTC), soonest first. */
  times: string[];
  status: ProposalStatus;
  method: NightMethod | null;
  notes: string;
  title: NightTitle | null;
  created_at: string;
};

/**
 * The couple's proposals that aren't a night yet: open ones and those your partner said none of to.
 * Use proposalView() to decide which of you sees what.
 */
export async function getProposals(coupleId: string, locales: string[]): Promise<NightProposal[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("night_proposals")
    .select(`id, proposed_by, times, status, method, notes, media_type, tmdb_id, created_at, ${TITLE_SELECT}`)
    .eq("couple_id", coupleId)
    .in("status", ["open", "declined"])
    .in("titles.title_texts.locale", locales)
    .order("created_at");
  if (error) throw error;
  return data.map((row) => ({
    id: row.id,
    proposed_by: row.proposed_by,
    times: row.times.toSorted(),
    status: row.status as ProposalStatus,
    method: isNightMethod(row.method) ? row.method : null,
    notes: row.notes,
    title: toTitle(row, locales),
    created_at: row.created_at,
  }));
}

/** Titles to pick from when planning: the list's "Up next" (watching or want), A to Z, keyed by titleKey(). */
export async function titleOptions(coupleId: string, locales: string[]) {
  const list = await getList(coupleId, locales);
  return list
    .filter((item) => item.status === "watching" || item.status === "want")
    .map((item) => ({ key: titleKey(item), title: item.title }))
    .sort((a, b) => a.title.localeCompare(b.title, locales[0]));
}

/** A title's name in a person's language (their home country's TMDB locale), or the original title. */
export async function titleNameFor(
  admin: SupabaseClient<Database>,
  title: TitleRef,
  person: { language: string; country: string | null },
) {
  const { data } = await admin
    .from("titles")
    .select("original_title, title_texts(locale, title)")
    .eq("media_type", title.media_type)
    .eq("tmdb_id", title.tmdb_id)
    .maybeSingle();
  const locale = person.country ? tmdbLocale(person.language, person.country) : null;
  return data?.title_texts.find((text) => text.locale === locale)?.title ?? data?.original_title ?? null;
}

export type NightChange = "planned" | "changed" | "cancelled" | "ready" | "bothReady" | "proposed" | "picked" | "declined";

/**
 * Tells the other member of the couple, on every device they've turned notifications on for, that a watch
 * night was planned, moved or cancelled, that you're ready for it, or about times proposed for one (`starts_at`
 * is then the list of times, and `tag` keeps one notification per proposal): in their language, at their local
 * time. Never throws.
 */
export async function notifyPartner(
  change: NightChange,
  night: { id: string; starts_at: string | string[]; title: TitleRef | null; tag?: string },
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
    const name = (night.title && (await titleNameFor(admin, night.title, partner))) || t.push.noTitle;
    const when = [night.starts_at]
      .flat()
      .map((at) => {
        const start = new Date(at);
        return `${formatDay(start, partner.time_zone, partner.language)}, ${formatTime(start, partner.time_zone, partner.language)}`;
      })
      .join(t.push.or);
    const text = t.push[change];
    await sendPush(
      admin,
      partner.push_subscriptions,
      {
        title: text.heading,
        body: text.body(name, when, by.display_name || getMessages(partner.language).common.yourPartner),
        url: "/watch-nights",
        tag: night.tag ?? `night-${night.id}`,
      },
      contact,
    );
  } catch (error) {
    console.error(`Telling the partner about watch night ${night.id} failed`, error);
  }
}
