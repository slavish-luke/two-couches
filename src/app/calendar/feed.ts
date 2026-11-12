import "server-only";
import { ALERT_STATUSES } from "@/lib/alert-rules";
import { getMessages, type Messages } from "@/lib/i18n";
import {
  FEED_DAYS_AHEAD,
  FEED_DAYS_BEHIND,
  FEED_REFRESH_MINUTES,
  isNightMethod,
  toIcs,
  type IcsEvent,
} from "@/lib/night-rules";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { pickText } from "@/lib/titles";
import { tmdbLocale } from "@/lib/tmdb";
import { nextEpisodes, releaseDates } from "@/lib/upcoming";
import { nightEvent, type EventPerson } from "./night-event";
import { episodeEvents, releaseEvents } from "./release-events";
import { hashFeedToken } from "./token";

const DAY_MS = 24 * 60 * 60 * 1000;

/** When the signed-in person made their calendar link, or null if they haven't (or turned it off). */
export async function getMyFeedCreatedAt(profileId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("calendar_feeds").select("created_at").eq("profile_id", profileId).maybeSingle();
  if (error) throw error;
  return data?.created_at ?? null;
}

/**
 * The calendar for a feed token: the owner's couple's watch nights from a month ago to a year ahead, in the
 * owner's language, with both people's local times, plus (Sprint 19) all-day events for list titles' release
 * days and next episodes over the same span. Null for an unknown (or revoked) token.
 *
 * There's no session here (calendar apps fetch it), so it uses the admin client: the token is the only
 * key, and it only ever reads the one couple the token belongs to.
 */
export async function feedCalendar(token: string, origin: string) {
  const admin = createAdminClient();
  if (!admin) throw new Error("SUPABASE_SECRET_KEY is needed for calendar feeds");

  const { data: feed, error: feedError } = await admin
    .from("calendar_feeds")
    .select("profiles(id, display_name, language, country, time_zone, couple_id)")
    .eq("token_hash", hashFeedToken(token))
    .maybeSingle();
  if (feedError) throw feedError;
  const owner = feed?.profiles;
  if (!owner) return null;

  const t = getMessages(owner.language);
  const people: EventPerson[] = [{ name: t.common.you, timeZone: owner.time_zone }];
  const locales = owner.country ? [tmdbLocale(owner.language, owner.country)] : [];
  let nights: Parameters<typeof nightEvent>[0][] = [];
  let extras: IcsEvent[] = [];

  if (owner.couple_id) {
    const { data: partner, error: partnerError } = await admin
      .from("profiles")
      .select("display_name, language, country, time_zone")
      .eq("couple_id", owner.couple_id)
      .neq("id", owner.id)
      .maybeSingle();
    if (partnerError) throw partnerError;
    if (partner) {
      people.push({ name: partner.display_name || t.common.yourPartner, timeZone: partner.time_zone });
      if (partner.country) locales.push(tmdbLocale(partner.language, partner.country));
    }

    const now = Date.now();
    const { data, error } = await admin
      .from("watch_nights")
      .select(
        "id, starts_at, updated_at, method, link, syncplay_server, syncplay_room, notes, media_type, titles(original_title, poster_path, runtime, title_texts(locale, title, poster_path))",
      )
      .eq("couple_id", owner.couple_id)
      .gte("starts_at", new Date(now - FEED_DAYS_BEHIND * DAY_MS).toISOString())
      .lte("starts_at", new Date(now + FEED_DAYS_AHEAD * DAY_MS).toISOString())
      .in("titles.title_texts.locale", locales)
      .order("starts_at");
    if (error) throw error;
    nights = data.map((row) => ({
      ...row,
      method: isNightMethod(row.method) ? row.method : null,
      title:
        row.titles && row.media_type
          ? {
              title: pickText(row.titles.title_texts, locales, row.titles).title,
              media_type: row.media_type,
              runtime: row.titles.runtime,
            }
          : null,
    }));

    const countries = [...new Set([owner.country, partner?.country].filter((c): c is string => Boolean(c)))];
    extras = await listTitleEvents(admin, owner.couple_id, { t, locales, countries, origin, now });
  }

  return toIcs(
    [...nights.map((night) => nightEvent(night, { t, language: owner.language, people, origin })), ...extras],
    { name: t.nights.calendar.feedName, refreshMinutes: FEED_REFRESH_MINUTES },
  );
}

/** List films older than this (by TMDB's first release) aren't asked about: no release is coming. */
const RELEASED_LONG_AGO_DAYS = 365;

/**
 * Sprint 19: release days (cinema and digital, in each of your countries) of films on the list and the next
 * episode of each series on it, as all-day events over the feed's span. From TMDB through Next's fetch
 * cache, like Coming soon. Never throws: on trouble the feed keeps its nights and leaves these out.
 */
async function listTitleEvents(
  admin: NonNullable<ReturnType<typeof createAdminClient>>,
  coupleId: string,
  { t, locales, countries, origin, now }: { t: Messages; locales: string[]; countries: string[]; origin: string; now: number },
): Promise<IcsEvent[]> {
  try {
    const { data, error } = await admin
      .from("list_items")
      .select("media_type, tmdb_id, titles(original_title, poster_path, release_date, title_texts(locale, title, poster_path))")
      .eq("couple_id", coupleId)
      .in("status", ALERT_STATUSES)
      .in("titles.title_texts.locale", locales);
    if (error) throw error;

    const day = (offsetDays: number) => new Date(now + offsetDays * DAY_MS).toISOString().slice(0, 10);
    const window = { from: day(-FEED_DAYS_BEHIND), to: day(FEED_DAYS_AHEAD) };
    const longAgo = day(-RELEASED_LONG_AGO_DAYS);
    const titled = data.map((row) => ({ ...row, title: pickText(row.titles.title_texts, locales, row.titles).title }));
    const films = titled.filter(
      (row) => row.media_type === "movie" && (!row.titles.release_date || row.titles.release_date >= longAgo),
    );
    const series = titled.filter((row) => row.media_type === "tv");

    const [dates, next] = await Promise.all([
      releaseDates(films.map((f) => f.tmdb_id), countries),
      nextEpisodes(series.map((s) => s.tmdb_id)),
    ]);
    const context = { t, window, origin };
    return [
      ...releaseEvents(
        films.flatMap((f) => (dates[f.tmdb_id] ? [{ tmdb_id: f.tmdb_id, title: f.title, releases: dates[f.tmdb_id] }] : [])),
        countries,
        context,
      ),
      ...episodeEvents(
        series.flatMap((s) => (next[s.tmdb_id] ? [{ tmdb_id: s.tmdb_id, title: s.title, next: next[s.tmdb_id] }] : [])),
        context,
      ),
    ];
  } catch (error) {
    console.error("Adding release and episode days to a calendar feed failed", error);
    return [];
  }
}
