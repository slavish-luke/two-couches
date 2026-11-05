/** After-the-night rules: when a wrap-up is due, and reviews. Pure functions, safe in server and client code. Mirrors the checks on list_reviews. */
import { episodeAfter, type Progress } from "./list-rules";
import { DEFAULT_LENGTH_MIN } from "./night-rules";
import type { MediaType } from "./watch";

export const MAX_REVIEW_LENGTH = 1000;
/** How long after a night ends its "How was it?" card keeps showing. */
export const WRAPUP_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

/** A trimmed review, "" for none (which deletes it), or null if it's too long. */
export function cleanReview(value: unknown): string | null {
  const body = typeof value === "string" ? value.trim() : "";
  return body.length <= MAX_REVIEW_LENGTH ? body : null;
}

/**
 * When a night ends: start plus the film's runtime, or DEFAULT_LENGTH_MIN for a series or when the runtime
 * isn't known (a typical episode is shorter, but you might watch several).
 */
export function nightEndsAt(night: { starts_at: string; media_type: MediaType; runtime: number | null }) {
  const minutes = night.media_type === "movie" && night.runtime ? night.runtime : DEFAULT_LENGTH_MIN;
  return new Date(Date.parse(night.starts_at) + minutes * 60000);
}

/** Whether a night has ended, within the last WRAPUP_DAYS. */
export function isWrapupDue(night: Parameters<typeof nightEndsAt>[0], now: Date) {
  const end = nightEndsAt(night).getTime();
  return end <= now.getTime() && now.getTime() - end <= WRAPUP_DAYS * DAY_MS;
}

/** How far back a night can have started and still be due (the longest night counted is a day long). */
export function wrapupWindowStart(now: Date) {
  return new Date(now.getTime() - (WRAPUP_DAYS + 1) * DAY_MS);
}

/**
 * What "Watched up to" suggests after a night: the episode after the last one watched (S1 E1 if you hadn't
 * started), rolling over into the next season with TMDB's per-season counts. Past the series' last episode
 * it stays on that episode.
 */
export function nextEpisode(progress: Progress | null, seasonEpisodes: number[] | null = null): Progress {
  return episodeAfter(progress, seasonEpisodes) ?? progress ?? { season: 1, episode: 1 };
}

/**
 * What you may see of your partner's review: nothing (they haven't written one), "hidden" (they have, but
 * you haven't written yours), or the text.
 */
export type PartnerReview = { state: "none" } | { state: "hidden" } | { state: "shown"; body: string };

export type Reviews = { mine: string | null; partner: PartnerReview };
