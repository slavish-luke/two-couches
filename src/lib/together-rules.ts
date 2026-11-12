/**
 * Sprint 20's little things for two, as pure rules (safe in server and client code): thinking-of-you
 * nudges, the day's question, comments and their reactions, hidden episode reactions, night photo albums
 * and the couches' mood.
 */
import { REACTIONS, type Reaction } from "./room-rules";

export { REACTIONS, isReaction, type Reaction } from "./room-rules";

const DAY_MS = 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Nudges
// ---------------------------------------------------------------------------

/** What a nudge says: a heart, "starting soon" or "ready when you are". */
export const NUDGE_KINDS = ["heart", "soon", "ready"] as const;
export type NudgeKind = (typeof NUDGE_KINDS)[number];

export function isNudgeKind(value: unknown): value is NudgeKind {
  return typeof value === "string" && (NUDGE_KINDS as readonly string[]).includes(value);
}

/** One nudge a minute per person (the database says so too: check_nudge()). */
export const NUDGE_GAP_MS = 60 * 1000;

/** How long until you may nudge again, in ms (0 when you may now). */
export function nudgeWait(lastSentAt: string | null, now: number) {
  if (!lastSentAt) return 0;
  return Math.max(0, Date.parse(lastSentAt) + NUDGE_GAP_MS - now);
}

/** A nudge arriving this soon after it was sent makes the couch react when the page opens. */
export const NUDGE_FRESH_MS = 2 * 60 * 1000;

// ---------------------------------------------------------------------------
// Tonight's question
// ---------------------------------------------------------------------------

/** The first day there was a question; days count from here. */
const QUESTION_EPOCH = Date.UTC(2026, 0, 1);

/** Today's date in UTC as YYYY-MM-DD: the question's day, the same for both of you. */
export function utcDay(now: Date) {
  return now.toISOString().slice(0, 10);
}

export function isDayString(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

/**
 * Which of `count` questions belongs to a day: a fixed walk through the whole list (a step that shares no
 * factor with the count visits every question once before any repeats), so neighbouring days don't get
 * neighbouring questions.
 */
export function questionIndex(day: string, count: number) {
  if (count <= 0) return 0;
  const days = Math.round((Date.parse(`${day}T00:00:00Z`) - QUESTION_EPOCH) / DAY_MS);
  let step = 37 % count || 1;
  while (gcd(step, count) !== 1) step += 1;
  return (((days * step) % count) + count) % count;
}

export const MAX_ANSWER_LENGTH = 300;

/** An answer as saved: one paragraph, trimmed. Empty means nothing to save. */
export function cleanAnswer(text: string) {
  return text.replace(/\s+/g, " ").trim().slice(0, MAX_ANSWER_LENGTH).trim();
}

/** Days before today to list on the questions page. */
export const QUESTION_HISTORY_DAYS = 90;

/** The day `days` before this one (YYYY-MM-DD). */
export function dayBefore(day: string, days: number) {
  return new Date(Date.parse(`${day}T00:00:00Z`) - days * DAY_MS).toISOString().slice(0, 10);
}

/** What you can see of your partner's answer, review or episode reaction. */
export type Reveal<T> = { state: "none" } | { state: "hidden" } | { state: "shown"; value: T };

/**
 * The hidden-until-you've-answered rule, as the app shows it: nothing when they haven't, hidden when they
 * have and you haven't, shown once you both have. (RLS hands over their row only in the last case.)
 */
export function reveal<T>(mine: unknown, theirs: T | null | undefined, theyHave: boolean): Reveal<T> {
  if (theirs != null && mine != null) return { state: "shown", value: theirs };
  if (theyHave || theirs != null) return { state: "hidden" };
  return { state: "none" };
}

// ---------------------------------------------------------------------------
// Comments and reactions
// ---------------------------------------------------------------------------

export const MAX_COMMENT_LENGTH = 500;

/** A comment as saved: line breaks kept (at most two in a row), trimmed. */
export function cleanComment(text: string) {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/[^\S\n]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, MAX_COMMENT_LENGTH)
    .trim();
}

/** Reactions on a comment, in REACTIONS order, each with who gave it. */
export function reactionGroups(reactions: { profile_id: string; kind: string }[]) {
  return REACTIONS.flatMap((kind) => {
    const by = reactions.filter((r) => r.kind === kind).map((r) => r.profile_id);
    return by.length > 0 ? [{ kind, by }] : [];
  });
}

/** Comments shown before "Show earlier ones". */
export const COMMENTS_SHOWN = 6;

// ---------------------------------------------------------------------------
// Episode reactions
// ---------------------------------------------------------------------------

export const MAX_EPISODE_NOTE_LENGTH = 120;

export function cleanEpisodeNote(text: string) {
  return text.replace(/\s+/g, " ").trim().slice(0, MAX_EPISODE_NOTE_LENGTH).trim();
}

type Progress = { status: string; season: number | null; episode: number | null };

/**
 * Whether the list's progress says an episode has been watched (the database's episode_watched()): the
 * series is marked watched, or the episode is at or before the last one watched. Spoiler-safe: nothing
 * later can be reacted to, so nothing later is listed.
 */
export function isEpisodeWatched(item: Progress, season: number, episode: number) {
  if (item.status === "watched") return true;
  if (item.season == null || item.episode == null) return false;
  return season < item.season || (season === item.season && episode <= item.episode);
}

/**
 * The episodes you can react to, by season (newest season first): every episode of a season you've
 * finished, and up to the last one watched in the current one. A series marked watched counts every
 * episode TMDB knows of. Without TMDB's per-season counts, earlier seasons are left out (their length is
 * unknown) and the current season runs up to the last one watched.
 */
export function watchedSeasons(item: Progress, seasonEpisodes: number[] | null) {
  const seasons: { season: number; episodes: number }[] = [];
  if (item.status === "watched") {
    (seasonEpisodes ?? []).forEach((episodes, i) => {
      if (episodes > 0) seasons.push({ season: i + 1, episodes });
    });
  } else if (item.season != null && item.episode != null && item.season > 0) {
    for (let season = 1; season < item.season; season += 1) {
      const episodes = seasonEpisodes?.[season - 1];
      if (episodes) seasons.push({ season, episodes });
    }
    if (item.episode > 0) seasons.push({ season: item.season, episodes: item.episode });
  }
  return seasons.reverse();
}

/** How an episode is keyed in maps: "2x5". */
export function episodeKey(season: number, episode: number) {
  return `${season}x${episode}`;
}

// ---------------------------------------------------------------------------
// Photo albums
// ---------------------------------------------------------------------------

export const MAX_PHOTOS_PER_NIGHT = 30;
/** The longest side of a photo as stored, and of its thumbnail. */
export const PHOTO_LONG_SIDE = 1600;
export const THUMB_LONG_SIDE = 480;
/** The biggest picture we'll try to read (before resizing). */
export const MAX_PHOTO_INPUT_BYTES = 40 * 1024 * 1024;
/** Space a couple may use for photos: Supabase's free plan has 1 GB in all. */
export const COUPLE_PHOTO_BYTES = 800 * 1024 * 1024;
/** Bucket and its limit per file (the migration's). */
export const PHOTO_BUCKET = "night-photos";
export const MAX_PHOTO_FILE_BYTES = 3 * 1024 * 1024;

/** Width and height scaled down (never up) so the longer side is at most `max`. */
export function fitWithin(width: number, height: number, max: number) {
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

/** Where a photo and its thumbnail live in the bucket. */
export function photoPaths(coupleId: string, nightId: string, photoId: string, extension: "webp" | "jpg") {
  const folder = `${coupleId}/${nightId}`;
  return { path: `${folder}/${photoId}.${extension}`, thumb_path: `${folder}/${photoId}-thumb.${extension}` };
}

/** "340 KB", "4.2 MB": sizes in the viewer's language. */
export function formatBytes(bytes: number, language: string) {
  const mb = bytes / (1024 * 1024);
  if (mb >= 1) {
    return `${new Intl.NumberFormat(language, { maximumFractionDigits: mb < 10 ? 1 : 0 }).format(mb)} MB`;
  }
  return `${new Intl.NumberFormat(language, { maximumFractionDigits: 0 }).format(Math.max(1, bytes / 1024))} KB`;
}

/** Albums can be added to once a night has started (and afterwards for good). */
export function albumOpen(startsAt: string, now: number) {
  return Date.parse(startsAt) <= now;
}

// ---------------------------------------------------------------------------
// The couches' mood
// ---------------------------------------------------------------------------

export const COUCH_MOODS = ["sleepy", "content", "happy", "delighted"] as const;
export type CouchMood = (typeof COUCH_MOODS)[number];

/** Nights counted for the mood, and how long a gap makes the couches sleepy. */
export const MOOD_WINDOW_DAYS = 14;
export const SLEEPY_AFTER_DAYS = 21;

/**
 * How the couches feel about how often you've watched together lately, from the starts of your watch nights
 * (UTC): three or more nights in the last two weeks is delighted, one or two happy; none in two weeks but one
 * within three is content, and a longer gap is sleepy. A couple with no nights yet is content (nothing to
 * sulk about). Nights still to come don't count.
 */
export function couchMood(nightStarts: string[], now: Date): CouchMood {
  const t = now.getTime();
  const past = nightStarts.map((s) => Date.parse(s)).filter((s) => Number.isFinite(s) && s <= t);
  if (past.length === 0) return "content";
  const recent = past.filter((s) => s > t - MOOD_WINDOW_DAYS * DAY_MS).length;
  if (recent >= 3) return "delighted";
  if (recent >= 1) return "happy";
  const latest = Math.max(...past);
  return latest > t - SLEEPY_AFTER_DAYS * DAY_MS ? "content" : "sleepy";
}

// ---------------------------------------------------------------------------
// Time
// ---------------------------------------------------------------------------

/** "just now", "5 min ago", "3 hours ago", "2 days ago" in the viewer's language. */
export function timeAgo(at: string, now: number, language: string) {
  const seconds = Math.max(0, Math.round((now - Date.parse(at)) / 1000));
  const format = new Intl.RelativeTimeFormat(language, { numeric: "auto", style: "short" });
  if (seconds < 45) return format.format(0, "second");
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return format.format(-minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (hours < 24) return format.format(-hours, "hour");
  return format.format(-Math.round(hours / 24), "day");
}

/** Reaction kinds as a type guard for rows from the database. */
export function asReaction(kind: string): Reaction | null {
  return (REACTIONS as readonly string[]).includes(kind) ? (kind as Reaction) : null;
}
