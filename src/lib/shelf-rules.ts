/**
 * Sprint 21's rules: the Someday shelf, sending a title to your partner, hidden season reviews and the
 * Translate button. Pure functions, safe in server and client code. Mirrors the checks in
 * 20261112210000_list_and_notes.sql.
 */

import type { ListStatus } from "./list-rules";

// ---------------------------------------------------------------------------
// The Someday shelf
// ---------------------------------------------------------------------------

/** Up next: what Pick, the swipe deck, alerts and the daily check look at. Someday is left out on purpose. */
export const UP_NEXT_STATUSES: ListStatus[] = ["watching", "want"];

/** Whether a title in this status can go on the Someday shelf with one tap (from Up next). */
export function canShelve(status: ListStatus) {
  return UP_NEXT_STATUSES.includes(status);
}

/**
 * The status one tap moves a title to: from Up next onto the shelf, and from the shelf back to Up next
 * (Watching when a series was already started, so its progress isn't lost). Null for watched and dropped.
 */
export function shelfMove(item: { status: ListStatus; season: number | null; episode: number | null }): ListStatus | null {
  if (item.status === "someday") return item.season && item.episode ? "watching" : "want";
  return canShelve(item.status) ? "someday" : null;
}

/** Starting a title (progress, a wrap-up) moves it out of Want to watch, or off the shelf, into Watching. */
export function startsWatching(status: ListStatus) {
  return status === "want" || status === "someday";
}

// ---------------------------------------------------------------------------
// Sending a title
// ---------------------------------------------------------------------------

export const MAX_SEND_NOTE = 200;

export const SEND_ANSWERS = ["added", "shelved", "waved"] as const;

export type SendAnswer = (typeof SEND_ANSWERS)[number];

export function isSendAnswer(value: unknown): value is SendAnswer {
  return typeof value === "string" && (SEND_ANSWERS as readonly string[]).includes(value);
}

/** A send's note: trimmed, spaces squeezed (it's one line), or null when it's too long. "" for none. */
export function cleanSendNote(value: unknown): string | null {
  const note = typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
  return note.length <= MAX_SEND_NOTE ? note : null;
}

/** Where an answer puts the title on the list: Up next, the shelf, or nowhere for "Not for me". */
export function statusForAnswer(answer: SendAnswer): ListStatus | null {
  return answer === "added" ? "want" : answer === "shelved" ? "someday" : null;
}

// ---------------------------------------------------------------------------
// Hidden season reviews
// ---------------------------------------------------------------------------

export const MAX_SEASON_REVIEW = 500;

/** A season review as saved: trimmed; "" means delete it; null when too long. */
export function cleanSeasonReview(value: unknown): string | null {
  const body = typeof value === "string" ? value.trim() : "";
  return body.length <= MAX_SEASON_REVIEW ? body : null;
}

/** What you may see of your partner's review of one season, like Reviews' partner in review-rules.ts. */
export type PartnerSeasonReview = { state: "none" } | { state: "hidden" } | { state: "shown"; body: string };

/** Each season's reviews by season number: your own text and what you may see of your partner's. */
export type SeasonReviews = Record<number, { mine: string | null; partner: PartnerSeasonReview }>;

/**
 * Builds SeasonReviews from the rows RLS lets you read (yours, and your partner's for seasons you've
 * reviewed) and the body-less signals (who has written one for each season).
 */
export function seasonReviewsFrom(
  rows: { season: number; profile_id: string; body: string }[],
  signals: { season: number; profile_id: string }[],
  myId: string,
): SeasonReviews {
  const result: SeasonReviews = {};
  const seasons = new Set([...rows.map((r) => r.season), ...signals.map((s) => s.season)]);
  for (const season of seasons) {
    const mine = rows.find((r) => r.season === season && r.profile_id === myId);
    const theirs = rows.find((r) => r.season === season && r.profile_id !== myId);
    const theyWrote = signals.some((s) => s.season === season && s.profile_id !== myId);
    result[season] = {
      mine: mine?.body ?? null,
      partner: theirs && mine ? { state: "shown", body: theirs.body } : theyWrote || theirs ? { state: "hidden" } : { state: "none" },
    };
  }
  return result;
}

// ---------------------------------------------------------------------------
// Translate
// ---------------------------------------------------------------------------

/** Google Translate takes about this much text in a link. */
export const TRANSLATE_LINK_MAX = 2000;

/** A link that opens Google Translate with the text, into `target` (a UI language such as "tr"). */
export function googleTranslateUrl(text: string, target: string) {
  const params = new URLSearchParams({ sl: "auto", tl: target, text: text.slice(0, TRANSLATE_LINK_MAX), op: "translate" });
  return `https://translate.google.com/?${params}`;
}

/** Whether two language tags are the same language ("en-GB" and "en" are). */
export function sameLanguage(a: string, b: string) {
  return a.split("-")[0].toLowerCase() === b.split("-")[0].toLowerCase();
}

/**
 * The language to translate from when the browser can't tell: the most confident detection above
 * `MIN_CONFIDENCE`, else the other of the app's languages (these two people write in one or the other).
 */
export function sourceLanguage(
  detected: { detectedLanguage?: string; confidence?: number }[] | null,
  target: string,
  languages: readonly string[],
): string {
  const best = detected
    ?.filter((d) => d.detectedLanguage && d.detectedLanguage !== "und" && (d.confidence ?? 0) >= MIN_CONFIDENCE)
    .sort((x, y) => (y.confidence ?? 0) - (x.confidence ?? 0))[0];
  if (best?.detectedLanguage) return best.detectedLanguage.split("-")[0];
  return languages.find((l) => !sameLanguage(l, target)) ?? "en";
}

export const MIN_CONFIDENCE = 0.5;
