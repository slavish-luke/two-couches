/**
 * Sprint 22's time together, as pure rules (safe in server and client code): "I'm free tonight", the state
 * under each Home clock, "Made in one of our countries" and the "All our nights" timeline.
 */
import { localDate } from "./list-rules";
import { addDays, fitFor, hoursOfDay, zonedParts, type Fit } from "./night-rules";
import { bestSlots, slotHeat } from "./planning-rules";
import { anniversary, filmsInOrder, firstNightDate, type NightAt, type RatedEntry } from "./taste-rules";
import { titleKey, type TitleRef } from "./watch";

const HOUR_MS = 60 * 60 * 1000;

// ---------------------------------------------------------------------------------------------------------
// The state under each clock
// ---------------------------------------------------------------------------------------------------------

/**
 * What someone is probably up to right now on their own clock, by the same rule the hour grid uses
 * (fitFor(), which rateSlot() is built on): free time (evenings, weekend afternoons), busy hours, or asleep
 * (midnight to 8 am).
 */
export function clockState(now: Date, timeZone: string): Fit {
  return fitFor(now, timeZone);
}

/** When the state under a clock can next change: the top of the next hour on that clock (plus a moment). */
export function nextStateChange(now: Date, timeZone: string) {
  const { minute, second } = zonedParts(now, timeZone);
  // Zones a half or quarter hour off UTC still change on their own hour, which zonedParts() already gives.
  return Math.max(1000, ((60 - minute) * 60 - second) * 1000 + 500);
}

// ---------------------------------------------------------------------------------------------------------
// "I'm free tonight"
// ---------------------------------------------------------------------------------------------------------

/** Someone's evening: their time zone and the local date it's on. */
export type Evening = { zone: string; day: string };

/** Each person's "tonight": today's date on their own clock. */
export function tonightFor(timeZone: string, now: Date): Evening {
  return { zone: timeZone, day: localDate(timeZone, now) };
}

/** A free-evening row as read from free_evenings. */
export type FreeRow = { profile_id: string; on_day: string; free: boolean };

/** Whether this person said they're free on this local date (and didn't take it back). */
export function isFreeOn(rows: FreeRow[], profileId: string, day: string) {
  return rows.some((r) => r.profile_id === profileId && r.on_day === day && r.free);
}

/** Whether a first "I'm free" may carry a push: only the first time that evening (no row yet). */
export function isFirstTap(rows: FreeRow[], profileId: string, day: string) {
  return !rows.some((r) => r.profile_id === profileId && r.on_day === day);
}

/**
 * "Tonight" starts at noon on each person's clock. Not later: 7–8 hours apart, one person's evening is the
 * other's afternoon, and that's still a night together. Not earlier: a morning start isn't tonight (13 hours
 * apart it suggested 8 am to someone who'd just said they're free tonight).
 */
export const TONIGHT_FROM_HOUR = 12;

/**
 * The best start tonight for everyone: an hour from now on that falls on each person's own tonight (their
 * local date when they said so, from TONIGHT_FROM_HOUR), within the next day. The best by bestSlots() (free
 * time on every clock, the most prime time), else the warmest by slotHeat(), else null when nobody's awake
 * together tonight. The planner's date and time come from `plannerZone`, the form's clock.
 */
export function tonightSlot(now: Date, evenings: Evening[], plannerZone: string) {
  if (evenings.length === 0) return null;
  const zones = evenings.map((e) => e.zone);
  const today = localDate(plannerZone, now);
  const starts = [today, addDays(today, 1)]
    .flatMap((date) => hoursOfDay(date, plannerZone))
    .filter((s) => s.getTime() + HOUR_MS > now.getTime() && s.getTime() < now.getTime() + 24 * HOUR_MS)
    .filter((s) => evenings.every((e) => localDate(e.zone, s) === e.day && zonedParts(s, e.zone).hour >= TONIGHT_FROM_HOUR));
  const best = bestSlots(starts, zones, now);
  const warm = starts.filter((s) => slotHeat(s, zones) > 0);
  const top = Math.max(0, ...warm.map((s) => slotHeat(s, zones)));
  const pick = starts.find((s) => best.has(s.getTime())) ?? warm.find((s) => slotHeat(s, zones) === top) ?? null;
  if (!pick) return null;
  // An hour that's already begun starts at the next quarter hour instead.
  const start = pick.getTime() < now.getTime() ? new Date(Math.ceil(now.getTime() / (15 * 60_000)) * 15 * 60_000) : pick;
  const { date, time } = zonedParts(start, plannerZone);
  return { date, time, at: start };
}

// ---------------------------------------------------------------------------------------------------------
// Made in one of our countries
// ---------------------------------------------------------------------------------------------------------

/** Both of your home countries (ISO codes), once each, sorted: the same on both screens. */
export function ourCountries(codes: (string | null | undefined)[]) {
  return [...new Set(codes.filter((c): c is string => typeof c === "string" && /^[A-Z]{2}$/.test(c)))].sort();
}

/** Whether a title with these origin countries was made in one of yours. Unknown (null) isn't. */
export function madeIn(origins: readonly string[] | null | undefined, countries: readonly string[]) {
  return !!origins && origins.some((c) => countries.includes(c));
}

// ---------------------------------------------------------------------------------------------------------
// All our nights
// ---------------------------------------------------------------------------------------------------------

/** A past night on the timeline, as the rules need it. */
export type TimelineNight = { id: string; starts_at: string; zone: string; title: TitleRef | null };

/** An entry of the list for the timeline: a rated entry with its title and its rewatches. */
export type TimelineEntry = RatedEntry &
  TitleRef & { rewatches: { watched_on: string; ratings: Record<string, number> }[] };

export type TimelineMilestone =
  | { kind: "first" }
  | { kind: "film"; number: number }
  | { kind: "anniversary"; years: number; date: string };

/** How many past nights the timeline shows at first, and how many more each "Show more" adds. */
export const TIMELINE_STEP = 30;

/** The night's date on its planner's clock (as streaks and milestones count it). */
export function nightDate(night: Pick<TimelineNight, "starts_at" | "zone">) {
  return localDate(night.zone, new Date(night.starts_at));
}

/**
 * What the timeline marks on each night (by night ID) and the anniversaries between them. Every night gets
 * its number (1 is the first). "Your first night" goes on the first. "Film #N together" (filmsInOrder())
 * goes on the night of that film whose date is the day it was marked watched, else on its latest night up to
 * that day, else its latest night. Anniversaries of the first night (anniversary()) up to `today` come with
 * their dates, so they can sit between the nights.
 */
export function timelineMarks(nights: TimelineNight[], entries: TimelineEntry[], now: Date, today: string) {
  const ordered = nights
    .filter((n) => Date.parse(n.starts_at) <= now.getTime())
    .toSorted((a, b) => a.starts_at.localeCompare(b.starts_at));
  const numbers = new Map(ordered.map((n, i) => [n.id, i + 1]));
  const marks = new Map<string, TimelineMilestone[]>();
  const add = (id: string, m: TimelineMilestone) => marks.set(id, [...(marks.get(id) ?? []), m]);
  if (ordered[0]) add(ordered[0].id, { kind: "first" });

  filmsInOrder(entries).forEach((film, i) => {
    const of = ordered.filter((n) => n.title && titleKey(n.title) === titleKey(film));
    if (of.length === 0) return;
    const on = film.watched_on;
    const night =
      (on ? (of.find((n) => nightDate(n) === on) ?? of.findLast((n) => nightDate(n) <= on)) : undefined) ?? of.at(-1)!;
    add(night.id, { kind: "film", number: i + 1 });
  });

  const atNights: NightAt[] = ordered.map((n) => ({ starts_at: n.starts_at, zone: n.zone }));
  const first = firstNightDate(atNights, now);
  const anniversaries: Extract<TimelineMilestone, { kind: "anniversary" }>[] = [];
  if (first) {
    const { years } = anniversary(first, today);
    const firstYear = Number(first.slice(0, 4));
    for (let year = 1; year <= years; year++) {
      // Seen from the last day of the year before, the next anniversary is that year's.
      const date = anniversary(first, `${firstYear + year - 1}-12-31`).next;
      anniversaries.push({ kind: "anniversary", years: year, date });
    }
  }
  return { numbers, marks, anniversaries };
}

/**
 * Both of your ratings for the night: a rewatch logged on the night's date (on either clock) has its own,
 * else the list entry's. `rewatch` says which it was.
 */
export function nightRatings(entry: TimelineEntry | undefined, dates: string[]) {
  if (!entry) return null;
  const again = entry.rewatches.find((r) => dates.includes(r.watched_on));
  if (again) return { ratings: again.ratings, rewatch: true };
  return { ratings: entry.ratings, rewatch: false };
}
