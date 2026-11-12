/**
 * Taste and milestones for two (Sprint 17): taste match, predicted ratings, where you disagree, rating
 * guesses, weekly streaks, milestones and the stickers they earn. Pure functions, safe in server and client code.
 */
import { localDate } from "./list-rules";
import type { StatsEntry } from "./stats-rules";

/** The parts of a list entry the taste rules read (StatsEntry and ListEntry have them all). */
export type RatedEntry = Pick<StatsEntry, "id" | "media_type" | "status" | "watched_on" | "genre_ids" | "ratings">;

// ---------------------------------------------------------------------------------------------------------
// Taste match
// ---------------------------------------------------------------------------------------------------------

/** Titles you must both have rated before the taste match shows. */
export const TASTE_MIN_SHARED = 5;
/** What one star apart costs a title's score, in percent: same stars 100%, 1 apart 75%, ... 4 apart 0%. */
export const TASTE_STEP = 25;

/** Titles you've both rated, whatever their status. */
export function sharedRatings<T extends RatedEntry>(entries: T[], meId: string, partnerId: string | null): T[] {
  return partnerId ? entries.filter((e) => e.ratings[meId] && e.ratings[partnerId]) : [];
}

/**
 * How alike your ratings are: every title you've both rated scores 100% for the same stars, 25% less for
 * each star apart, and the match is the average, rounded. Null (with how many more are needed) until there
 * are TASTE_MIN_SHARED of them.
 */
export function tasteMatch(entries: RatedEntry[], meId: string, partnerId: string | null) {
  const shared = sharedRatings(entries, meId, partnerId);
  const needed = Math.max(0, TASTE_MIN_SHARED - shared.length);
  if (!partnerId || needed > 0) return { shared: shared.length, needed, percent: null };
  const total = shared.reduce((sum, e) => sum + (100 - TASTE_STEP * Math.abs(e.ratings[meId] - e.ratings[partnerId])), 0);
  return { shared: shared.length, needed: 0, percent: Math.round(total / shared.length) };
}

/** Stars apart on a title you've both rated. */
export function ratingGap(entry: RatedEntry, meId: string, partnerId: string) {
  return Math.abs(entry.ratings[meId] - entry.ratings[partnerId]);
}

/**
 * Where you disagree: titles 2★ or more apart, furthest first; and where you agree: the same stars, highest
 * first. Ties go to the latest watched.
 */
export function ratingPairs<T extends RatedEntry>(entries: T[], meId: string, partnerId: string | null, limit = 12) {
  const shared = sharedRatings(entries, meId, partnerId);
  if (!partnerId) return { splits: [], agreements: [] };
  const gap = (e: T) => ratingGap(e, meId, partnerId);
  const combined = (e: T) => e.ratings[meId] + e.ratings[partnerId];
  const latest = (a: T, b: T) => (b.watched_on ?? "").localeCompare(a.watched_on ?? "");
  return {
    splits: shared
      .filter((e) => gap(e) >= 2)
      .sort((a, b) => gap(b) - gap(a) || latest(a, b))
      .slice(0, limit),
    agreements: shared
      .filter((e) => gap(e) === 0)
      .sort((a, b) => combined(b) - combined(a) || latest(a, b))
      .slice(0, limit),
  };
}

// ---------------------------------------------------------------------------------------------------------
// Predicted ratings
// ---------------------------------------------------------------------------------------------------------

/** Rated titles in the same genres needed before a prediction shows. */
export const PREDICT_MIN = 3;

export type Prediction = {
  /** The average, to one decimal. */
  rating: number;
  /** How many rated titles it's the average of. */
  count: number;
  /** The title's genres those titles share, in the title's own order. */
  genreIds: number[];
};

/**
 * What `personId` would probably give a title in `genreIds`: the plain average of their ratings of every
 * other title on the list that shares at least one of its genres. Null with fewer than PREDICT_MIN of them.
 */
export function predictRating(entries: RatedEntry[], personId: string, genreIds: number[], excludeId: string | null): Prediction | null {
  const rated = entries.filter(
    (e) => e.id !== excludeId && e.ratings[personId] && e.genre_ids.some((id) => genreIds.includes(id)),
  );
  if (rated.length < PREDICT_MIN) return null;
  const total = rated.reduce((sum, e) => sum + e.ratings[personId], 0);
  return {
    rating: Math.round((total / rated.length) * 10) / 10,
    count: rated.length,
    genreIds: genreIds.filter((id) => rated.some((e) => e.genre_ids.includes(id))),
  };
}

// ---------------------------------------------------------------------------------------------------------
// Guess their rating
// ---------------------------------------------------------------------------------------------------------

export type Guess = {
  list_item_id: string;
  /** Who guessed. */
  profile_id: string;
  /** 1-5, or null for "Just show me". */
  guess: number | null;
  /** The partner's rating when the guess was made. */
  actual: number;
};

/**
 * Whether to veil your partner's stars behind "Guess first?": a watched title they've rated, that you
 * haven't guessed (or skipped) yet.
 */
export function shouldAskGuess(entry: Pick<RatedEntry, "status" | "ratings">, partnerId: string | null, myGuess: Guess | null) {
  return Boolean(partnerId && entry.status === "watched" && entry.ratings[partnerId] && !myGuess);
}

/** A person's guesses, scored: how many they made (skips don't count), how many within a star, how many exact. */
export function guessScore(guesses: Guess[], personId: string) {
  const made = guesses.filter((g) => g.profile_id === personId && g.guess !== null);
  return {
    made: made.length,
    within: made.filter((g) => Math.abs(g.guess! - g.actual) <= 1).length,
    exact: made.filter((g) => g.guess === g.actual).length,
  };
}

// ---------------------------------------------------------------------------------------------------------
// Streaks and milestones
// ---------------------------------------------------------------------------------------------------------

/** A watch night for streaks: when it starts (UTC) and the time zone of whoever planned it. */
export type NightAt = { starts_at: string; zone: string };

const DAY_MS = 24 * 60 * 60 * 1000;
const dayNumber = (date: string) => Date.parse(`${date}T00:00:00Z`) / DAY_MS;
const fromDayNumber = (day: number) => new Date(day * DAY_MS).toISOString().slice(0, 10);

/** The Monday of a calendar date's week (weeks run Monday to Sunday), as a date. */
export function weekOf(date: string) {
  const day = dayNumber(date);
  // 1970-01-01 was a Thursday: day 0 is Thursday, so Monday is (day + 3) % 7 == 0.
  return fromDayNumber(day - ((day + 3) % 7));
}

/** Nights that have started by `now`, each as its date on the planner's clock. */
function nightDates(nights: NightAt[], now: Date) {
  return nights
    .filter((n) => Date.parse(n.starts_at) <= now.getTime())
    .map((n) => localDate(n.zone, new Date(n.starts_at)))
    .sort();
}

/**
 * Weeks in a row with a watch night that happened. A night counts in the week (Monday to Sunday) of its
 * date on the clock of whoever planned it. The current streak runs back from this week, or from last week
 * while this one has no night yet (it isn't over); `best` is the longest run ever.
 */
export function streaks(nights: NightAt[], now: Date, viewerZone: string) {
  const weeks = [...new Set(nightDates(nights, now).map(weekOf))].map(dayNumber).sort((a, b) => a - b);
  let best = 0;
  let run = 0;
  for (let i = 0; i < weeks.length; i++) {
    run = i > 0 && weeks[i] - weeks[i - 1] === 7 ? run + 1 : 1;
    best = Math.max(best, run);
  }
  const have = new Set(weeks);
  const thisWeek = dayNumber(weekOf(localDate(viewerZone, now)));
  let week = have.has(thisWeek) ? thisWeek : thisWeek - 7;
  let current = 0;
  while (have.has(week)) {
    current++;
    week -= 7;
  }
  return { current, best };
}

/** The date of your first watch night that happened (on its planner's clock), or null. */
export function firstNightDate(nights: NightAt[], now: Date) {
  return nightDates(nights, now)[0] ?? null;
}

/**
 * Your first night's anniversary as seen on `today` (a local date): whole years since, whether today is the
 * day, and the date of the next one. A first night on 29 February has its anniversary on 28 February in
 * other years.
 */
export function anniversary(first: string, today: string) {
  const on = (year: number) => {
    const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
    return `${year}-${first.slice(5) === "02-29" && !leap ? "02-28" : first.slice(5)}`;
  };
  const year = Number(today.slice(0, 4));
  const firstYear = Number(first.slice(0, 4));
  const thisYears = on(year);
  const years = year - firstYear - (today < thisYears ? 1 : 0);
  const next = today < thisYears ? thisYears : on(year + 1);
  return {
    years: Math.max(0, years),
    isToday: today === thisYears && year > firstYear,
    next,
    daysToNext: dayNumber(next) - dayNumber(today),
  };
}

/** Films you've watched together, oldest first by date watched: film #N is the Nth. */
export function filmsInOrder<T extends RatedEntry>(entries: T[]) {
  return entries
    .filter((e) => e.status === "watched" && e.media_type === "movie")
    .sort((a, b) => (a.watched_on ?? "").localeCompare(b.watched_on ?? ""));
}

/** Titles (films and series) marked watched. */
export function watchedCount(entries: RatedEntry[]) {
  return entries.filter((e) => e.status === "watched").length;
}

/** Whether you've both given anything five stars. */
export function bothFive(entries: RatedEntry[], meId: string, partnerId: string | null) {
  return sharedRatings(entries, meId, partnerId).some((e) => e.ratings[meId] === 5 && e.ratings[partnerId!] === 5);
}

/** Days after it was watched that the latest film still gets a "Film #N together" chip on Home. */
export const RECENT_FILM_DAYS = 7;

export type Highlight =
  | { kind: "anniversary"; years: number }
  | { kind: "streak"; weeks: number }
  | { kind: "film"; number: number };

/**
 * The one line for Home's chip, most special first: the anniversary of your first night (on the day), a
 * streak of 2 weeks or more, or the latest film if it was watched in the last RECENT_FILM_DAYS days.
 */
export function homeHighlight(entries: RatedEntry[], nights: NightAt[], now: Date, viewerZone: string): Highlight | null {
  const today = localDate(viewerZone, now);
  const first = firstNightDate(nights, now);
  if (first) {
    const a = anniversary(first, today);
    if (a.isToday) return { kind: "anniversary", years: a.years };
  }
  const { current } = streaks(nights, now, viewerZone);
  if (current >= 2) return { kind: "streak", weeks: current };
  const films = filmsInOrder(entries);
  const latest = films.at(-1);
  if (latest?.watched_on && dayNumber(today) - dayNumber(latest.watched_on) <= RECENT_FILM_DAYS) {
    return { kind: "film", number: films.length };
  }
  return null;
}

// ---------------------------------------------------------------------------------------------------------
// Stickers
// ---------------------------------------------------------------------------------------------------------

/** Watched titles that earn a sticker. */
export const TITLE_STEPS = [10, 25, 50, 100] as const;
/** Weeks in a row that earn the streak sticker. */
export const STREAK_STICKER = 4;

export type StickerId =
  | "firstNight"
  | `titles${(typeof TITLE_STEPS)[number]}`
  | "streak"
  | "bothFive"
  | "spotOn"
  | "oneYear";

export type Sticker = {
  id: StickerId;
  earned: boolean;
  /** For a count still to reach: how far along, e.g. 18 of 25. */
  progress?: { have: number; need: number };
};

/**
 * Every sticker to show: the one-offs (earned or not), and of the title counts every one earned plus the
 * next to aim for. Unearned ones show faint.
 */
export function stickers(facts: {
  nights: number;
  titles: number;
  bestStreak: number;
  bothFive: boolean;
  exactGuess: boolean;
  years: number;
}): Sticker[] {
  const list: Sticker[] = [{ id: "firstNight", earned: facts.nights > 0 }];
  for (const step of TITLE_STEPS) {
    const earned = facts.titles >= step;
    list.push({ id: `titles${step}`, earned, progress: earned ? undefined : { have: facts.titles, need: step } });
    if (!earned) break;
  }
  list.push(
    {
      id: "streak",
      earned: facts.bestStreak >= STREAK_STICKER,
      progress: facts.bestStreak >= STREAK_STICKER ? undefined : { have: facts.bestStreak, need: STREAK_STICKER },
    },
    { id: "bothFive", earned: facts.bothFive },
    { id: "spotOn", earned: facts.exactGuess },
    { id: "oneYear", earned: facts.years >= 1 },
  );
  return list;
}
