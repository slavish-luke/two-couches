/**
 * List and diary rules (Sprint 18): watching a title again, ratings per season and the next episode of each
 * series you're watching. Pure functions, safe in server and client code. Mirrors the checks on rewatches,
 * rewatch_ratings and season_ratings.
 */
import { episodeAfter, isDateString, type ListStatus, type Progress } from "./list-rules";

/** One more watch of a title on the list (the first is the list item's own watched_on). */
export type Rewatch = {
  id: string;
  list_item_id: string;
  /** A local date ("2026-03-12"). */
  watched_on: string;
  added_by: string | null;
  created_at: string;
  /** Rating (1-5) of this watch, by profile ID. */
  ratings: Record<string, number>;
};

/** Each person's rating of each season: season number → profile ID → 1-5. */
export type SeasonRatings = Record<number, Record<string, number>>;

/** The earliest date a watch can have (the table checks it too). */
export const FIRST_WATCH_DATE = "1900-01-01";
/** Seasons go up to this (the table's check). */
export const MAX_SEASON = 999;

/** A watch date is a real calendar date between FIRST_WATCH_DATE and `today` (the logger's local date). */
export function isWatchDate(value: unknown, today: string): value is string {
  return isDateString(value) && value >= FIRST_WATCH_DATE && value <= today;
}

export function isRating(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 1 && (value as number) <= 5;
}

export function isSeason(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 1 && (value as number) <= MAX_SEASON;
}

/** One line of a title's watch history: the first watch, or a rewatch with its own ratings. */
export type Watch = { date: string; rewatch: Rewatch | null };

/**
 * Every watch of a title, oldest first: the first watch (the list item's watched_on, when it has one), then
 * each rewatch. Rewatches logged on the same day keep the order they were logged in.
 */
export function watchHistory(firstWatchedOn: string | null, rewatches: Rewatch[]): Watch[] {
  const again = rewatches
    .toSorted((a, b) => a.watched_on.localeCompare(b.watched_on) || a.created_at.localeCompare(b.created_at))
    .map((rewatch) => ({ date: rewatch.watched_on, rewatch }));
  return firstWatchedOn ? [{ date: firstWatchedOn, rewatch: null }, ...again] : again;
}

/**
 * The seasons the panel offers to rate: every season once it's watched (or dropped), and up to the season
 * you're on while watching; plus any season either of you has already rated, so no rating ever hides.
 */
export function seasonsToRate(
  status: ListStatus,
  progress: Progress | null,
  seasons: number | null,
  rated: SeasonRatings,
): number[] {
  const reached = progress?.season ?? 0;
  const finished = status === "watched" || status === "dropped";
  const upTo = Math.min(finished ? Math.max(seasons ?? 0, reached) : status === "watching" ? reached : 0, MAX_SEASON);
  const all = new Set<number>();
  for (let s = 1; s <= upTo; s++) all.add(s);
  for (const [season, byPerson] of Object.entries(rated)) if (Object.keys(byPerson).length) all.add(Number(season));
  return [...all].sort((a, b) => a - b);
}

/** Average of the seasons someone rated, or null. */
export function seasonAverage(rated: SeasonRatings, profileId: string): number | null {
  const values = Object.values(rated).flatMap((byPerson) => (byPerson[profileId] ? [byPerson[profileId]] : []));
  return values.length ? values.reduce((sum, v) => sum + v, 0) / values.length : null;
}

/** An episode as TMDB announces it. */
export type AiredEpisode = Progress & { air_date: string | null };

/** What the next episodes row needs from TMDB's series details. */
export type EpisodeGuide = {
  /** Episodes in each season, season 1 first (null when TMDB lists none or numbers them by year). */
  seasonEpisodes: number[] | null;
  lastAired: AiredEpisode | null;
  nextToAir: AiredEpisode | null;
};

/** Where you are with a series: the next episode is out ("ready"), or due in `days` days ("soon"). */
export type NextUp =
  | { state: "ready"; episode: Progress }
  | { state: "soon"; episode: Progress; airDate: string; days: number };

/** Episode order: -1, 0 or 1. */
export function compareEpisodes(a: Progress, b: Progress) {
  return Math.sign(a.season - b.season || a.episode - b.episode);
}

/** Whole days from one local date to another ("2026-11-12" → "2026-11-14" is 2). */
export function daysBetween(from: string, to: string) {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

/**
 * The next episode of a series you're watching, from your progress and TMDB's guide: the episode after
 * yours once it has aired ("ready"), else the next announced one if it's after yours ("soon", or "ready"
 * once its date is today or past, since TMDB catches up a little late). Null when you're caught up and
 * nothing is announced, or TMDB knows too little.
 */
export function nextUp(progress: Progress | null, guide: EpisodeGuide, today: string): NextUp | null {
  const after = episodeAfter(progress, guide.seasonEpisodes);
  if (after && guide.lastAired && compareEpisodes(after, guide.lastAired) <= 0) return { state: "ready", episode: after };
  const next = guide.nextToAir;
  if (next && next.air_date && (!progress || compareEpisodes(next, progress) > 0)) {
    const episode = { season: next.season, episode: next.episode };
    const days = daysBetween(today, next.air_date);
    return days <= 0 ? { state: "ready", episode } : { state: "soon", episode, airDate: next.air_date, days };
  }
  return null;
}

/**
 * The next episodes row's order: what you can watch now first (the series you moved on most recently
 * first, as you're likely in the middle of it), then what's coming, soonest first.
 */
export function orderNextUp<T extends { next: NextUp; updated_at: string }>(rows: T[]): T[] {
  return rows.toSorted((a, b) => {
    if (a.next.state !== b.next.state) return a.next.state === "ready" ? -1 : 1;
    if (a.next.state === "soon" && b.next.state === "soon") return a.next.days - b.next.days || b.updated_at.localeCompare(a.updated_at);
    return b.updated_at.localeCompare(a.updated_at);
  });
}

/** How far ahead Home's list cards say "new episode in N d". */
export const EPISODE_CHIP_DAYS = 14;
