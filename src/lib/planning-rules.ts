/**
 * Planning nights: how good each hour is for both of you, the countdown to a night, when reminders are due,
 * proposals of several times and the prep checklist. Pure functions, safe in server and client code.
 */

import { getMessages } from "./i18n";
import { fitFor, rateSlot, zonedParts, type NightMethod, type SlotRating } from "./night-rules";
import { usesOwnFiles } from "./ready-rules";

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

// ---------------------------------------------------------------------------------------------------------
// The hour grid as a heat map
// ---------------------------------------------------------------------------------------------------------

/** Evening prime time on someone's own clock: from 7 pm until free time ends at 11 pm. */
const PRIME_FROM = 19;
const PRIME_UNTIL = 23;

/**
 * How good a start is for one person: 0 asleep, 1 awake, 2 free time, 3 an evening in prime time.
 */
export function fitPoints(date: Date, timeZone: string): number {
  const fit = fitFor(date, timeZone);
  if (fit === "asleep") return 0;
  if (fit === "awake") return 1;
  const { hour } = zonedParts(date, timeZone);
  return hour >= PRIME_FROM && hour < PRIME_UNTIL ? 3 : 2;
}

/**
 * How good a start is for everyone, from 0 (someone's asleep) to 1 (prime time on every clock). Someone
 * asleep makes it 0 whatever the others' clocks say.
 */
export function slotHeat(date: Date, timeZones: string[]) {
  const points = timeZones.map((zone) => fitPoints(date, zone));
  if (points.length === 0 || points.includes(0)) return 0;
  return points.reduce((sum, p) => sum + p, 0) / (3 * points.length);
}

/**
 * The best of these starts that haven't passed: free time for everyone (rateSlot "great") with the most
 * prime time. Empty when no start is great.
 */
export function bestSlots(starts: Date[], timeZones: string[], now: Date) {
  const great = starts.filter((s) => s.getTime() + HOUR > now.getTime() && rateSlot(s, timeZones) === "great");
  const top = Math.max(...great.map((s) => slotHeat(s, timeZones)));
  return new Set(great.filter((s) => slotHeat(s, timeZones) === top).map((s) => s.getTime()));
}

/** Day or night outside someone's window: night from 7 pm to 7 am on their clock. */
export type DayPart = "day" | "night";

export function dayPart(date: Date, timeZone: string): DayPart {
  const { hour } = zonedParts(date, timeZone);
  return hour >= 7 && hour < 19 ? "day" : "night";
}

/** How far through the hour starting at `start` `now` is (0 to 1), or null when `now` is outside it. */
export function nowWithin(start: Date, now: Date) {
  const into = now.getTime() - start.getTime();
  return into >= 0 && into < HOUR ? into / HOUR : null;
}

export type { SlotRating };

// ---------------------------------------------------------------------------------------------------------
// Countdown
// ---------------------------------------------------------------------------------------------------------

/** A night counts as "starting now" from 30 seconds before until this long after its start. */
export const STARTING_NOW_MS = 10 * MINUTE;

export type Countdown =
  | { kind: "days"; days: number; hours: number }
  | { kind: "hours"; hours: number; minutes: number }
  | { kind: "minutes"; minutes: number }
  | { kind: "now" }
  | { kind: "underWay" };

/** "in 2 d 4 h", "in 3 h 5 min", "in 35 min", "starting now", then under way. Minutes round up. */
export function countdown(start: Date, now: Date): Countdown {
  const left = start.getTime() - now.getTime();
  if (left <= -STARTING_NOW_MS) return { kind: "underWay" };
  if (left <= 30 * 1000) return { kind: "now" };
  const minutes = Math.ceil(left / MINUTE);
  if (minutes < 60) return { kind: "minutes", minutes };
  if (minutes < 24 * 60) return { kind: "hours", hours: Math.floor(minutes / 60), minutes: minutes % 60 };
  return { kind: "days", days: Math.floor(minutes / (24 * 60)), hours: Math.floor((minutes % (24 * 60)) / 60) };
}

/** The countdown in words: "in 2 d 4 h", "Starting now", "Under way". */
export function formatCountdown(start: Date, now: Date, language: string) {
  const t = getMessages(language).nights;
  const c = countdown(start, now);
  switch (c.kind) {
    case "days":
      return t.countdown.days(c.days, c.hours);
    case "hours":
      return t.countdown.hours(c.hours, c.minutes);
    case "minutes":
      return t.countdown.minutes(c.minutes);
    case "now":
      return t.countdown.now;
    case "underWay":
      return t.underWay;
  }
}

/** How long until the countdown's text next changes, so a ticking clock can wait just that long. */
export function nextTick(start: Date, now: Date) {
  const left = start.getTime() - now.getTime();
  if (left <= -STARTING_NOW_MS) return null;
  // To the next minute boundary of the time left (the text rounds up), at least a second away.
  const toBoundary = ((left % MINUTE) + MINUTE) % MINUTE;
  return Math.max(1000, toBoundary + 50);
}

// ---------------------------------------------------------------------------------------------------------
// Reminders before a night
// ---------------------------------------------------------------------------------------------------------

export const REMINDER_KINDS = ["day", "hour"] as const;

export type ReminderKind = (typeof REMINDER_KINDS)[number];

/**
 * When each reminder goes out, as time left before the start: due once at most `lead` is left (plus a
 * little slack for the job's own delay) and while more than `until` is. The job runs every 15 minutes,
 * so each window spans several runs. A night planned closer than a window gets no reminder of that kind
 * (the partner was just told), and nothing is sent once a night has started.
 */
export const REMINDER_WINDOWS: Record<ReminderKind, { lead: number; until: number }> = {
  day: { lead: 24 * HOUR, until: 23 * HOUR },
  hour: { lead: HOUR, until: 15 * MINUTE },
};

const SLACK_MS = 2 * MINUTE;

/** The reminder that's due for a night now, if any, leaving out the kinds already sent for this start. */
export function dueReminder(start: Date, now: Date, sent: readonly string[]): ReminderKind | null {
  const left = start.getTime() - now.getTime();
  for (const kind of REMINDER_KINDS) {
    const { lead, until } = REMINDER_WINDOWS[kind];
    if (left <= lead + SLACK_MS && left > until && !sent.includes(kind)) return kind;
  }
  return null;
}

/** The furthest ahead a reminder can be due, for the job's query. */
export const REMINDER_HORIZON_MS = REMINDER_WINDOWS.day.lead + SLACK_MS;

// ---------------------------------------------------------------------------------------------------------
// Proposals
// ---------------------------------------------------------------------------------------------------------

export const MIN_PROPOSAL_TIMES = 2;
export const MAX_PROPOSAL_TIMES = 3;
/** A time can still be picked this long after it passed, like planning a night that's just starting. */
export const PICK_GRACE_MS = 15 * MINUTE;

export type ProposalStatus = "open" | "picked" | "declined";

/** Whether a time in a proposal can still be picked. */
export function canPick(time: Date, now: Date) {
  return time.getTime() >= now.getTime() - PICK_GRACE_MS;
}

/**
 * What a proposal looks like to one of you: `answer` when it's waiting for you to pick, `waiting` while
 * your partner hasn't, `declined` when none worked, `expired` when every time passed unanswered, or
 * `hidden` (picked proposals are the night now; the partner doesn't see one they declined or that expired).
 */
export type ProposalView = "answer" | "waiting" | "declined" | "expired" | "hidden";

export function proposalView(
  proposal: { status: string; proposed_by: string; times: string[] },
  myId: string,
  now: Date,
): ProposalView {
  const mine = proposal.proposed_by === myId;
  if (proposal.status === "declined") return mine ? "declined" : "hidden";
  if (proposal.status !== "open") return "hidden";
  const open = proposal.times.some((t) => canPick(new Date(t), now));
  if (!open) return mine ? "expired" : "hidden";
  return mine ? "waiting" : "answer";
}

// ---------------------------------------------------------------------------------------------------------
// Prep checklist
// ---------------------------------------------------------------------------------------------------------

export const MAX_PREP_LABEL_LENGTH = 80;
export const MAX_PREP_ITEMS = 20;

/** A trimmed label with inner runs of space folded, or null if it's empty or too long. */
export function cleanPrepLabel(value: unknown) {
  const label = typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
  return label && label.length <= MAX_PREP_LABEL_LENGTH ? label : null;
}

/** Ideas for a night's prep list, most useful first, by how you'll watch. Keys into `nights.prep.ideas`. */
export const PREP_IDEAS = ["snacks", "subtitles", "file", "teleparty", "call", "drinks", "charged", "blanket"] as const;

export type PrepIdea = (typeof PREP_IDEAS)[number];

export function prepIdeas(method: NightMethod | null): PrepIdea[] {
  return PREP_IDEAS.filter((idea) => {
    if (idea === "file" || idea === "subtitles") return usesOwnFiles(method);
    if (idea === "teleparty") return method === "teleparty";
    if (idea === "call") return method === "other";
    return true;
  });
}
