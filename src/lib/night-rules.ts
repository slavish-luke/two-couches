/** Watch-night rules and time-zone maths. Pure functions, safe in server and client code. Mirrors the checks on watch_nights. */

export const NIGHT_METHODS = ["teleparty", "syncplay", "other"] as const;

export type NightMethod = (typeof NIGHT_METHODS)[number];

export function isNightMethod(value: unknown): value is NightMethod {
  return typeof value === "string" && (NIGHT_METHODS as readonly string[]).includes(value);
}

export const MAX_LINK_LENGTH = 500;
export const MAX_SYNCPLAY_LENGTH = 100;
export const MAX_NIGHT_NOTES_LENGTH = 500;
/** How far ahead a night can be planned. */
export const MAX_DAYS_AHEAD = 366;
/** A night is "upcoming" until this long after it starts, so one that's under way still shows. */
export const UNDER_WAY_MS = 3 * 60 * 60 * 1000;
/** Assumed length of a night when the title's runtime isn't known (or for a series). */
export const DEFAULT_LENGTH_MIN = 120;

/** A trimmed https URL, "" for none, or null if it isn't one. */
export function cleanLink(value: unknown): string | null {
  const link = typeof value === "string" ? value.trim() : "";
  if (!link) return "";
  if (link.length > MAX_LINK_LENGTH) return null;
  try {
    return new URL(link).protocol === "https:" ? link : null;
  } catch {
    return null;
  }
}

/** A Syncplay server: a host name with an optional port, e.g. "syncplay.example.com:8999". */
export function isSyncplayServer(value: string) {
  return value.length <= MAX_SYNCPLAY_LENGTH && /^[a-z0-9]([a-z0-9.-]*[a-z0-9])?(:\d{1,5})?$/i.test(value);
}

export function isTimeString(value: unknown): value is string {
  return typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** The wall-clock date and time of an instant in a zone. `weekday` is 0 for Sunday. */
export function zonedParts(date: Date, timeZone: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      weekday: "short",
      hourCycle: "h23",
      timeZone,
    })
      .formatToParts(date)
      .map((p) => [p.type, p.value]),
  );
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
    weekday: WEEKDAYS.indexOf(parts.weekday),
    /** "2026-11-07" */
    date: `${parts.year}-${parts.month}-${parts.day}`,
    /** "20:00" */
    time: `${parts.hour}:${parts.minute}`,
  };
}

/** How far the zone's wall clock is ahead of UTC at this instant, in milliseconds. */
function zoneOffsetMs(date: Date, timeZone: string) {
  const p = zonedParts(date, timeZone);
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(date.getTime() / 1000) * 1000;
}

/**
 * The instant a wall-clock date ("2026-11-07") and time ("20:00") happen in a zone. A time skipped by a
 * daylight-saving change comes out an hour later; one that happens twice comes out as one of the two.
 */
export function zonedToUtc(date: string, time: string, timeZone: string) {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const wall = Date.UTC(year, month - 1, day, hour, minute);
  const guess = wall - zoneOffsetMs(new Date(wall), timeZone);
  // The offset can differ at the real instant when a daylight-saving change falls in between.
  return new Date(wall - zoneOffsetMs(new Date(guess), timeZone));
}

/** "2026-11-08" for the day after "2026-11-07". */
export function addDays(date: string, days: number) {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

/** How a start time suits one person, by their local clock. */
export type Fit = "free" | "awake" | "asleep";

/** Evenings, and weekend afternoons too, are free time; midnight to 8 am is for sleeping. */
export function fitFor(date: Date, timeZone: string): Fit {
  const { hour, weekday } = zonedParts(date, timeZone);
  if (hour < 8) return "asleep";
  const weekend = weekday === 0 || weekday === 6;
  if (hour < 23 && hour >= (weekend ? 12 : 18)) return "free";
  return "awake";
}

/** "great": free time for everyone. "possible": everyone's awake. "late": someone's likely asleep. */
export type SlotRating = "great" | "possible" | "late";

export function rateSlot(date: Date, timeZones: string[]): SlotRating {
  const fits = timeZones.map((zone) => fitFor(date, zone));
  if (fits.every((f) => f === "free")) return "great";
  return fits.includes("asleep") ? "late" : "possible";
}

/** The start of each hour of a local date in a zone (23 or 25 of them on a daylight-saving change). */
export function hoursOfDay(date: string, timeZone: string) {
  const starts = new Map<number, Date>();
  for (let hour = 0; hour < 24; hour++) {
    const start = zonedToUtc(date, `${String(hour).padStart(2, "0")}:00`, timeZone);
    if (zonedParts(start, timeZone).date === date) starts.set(start.getTime(), start);
  }
  return [...starts.values()];
}

/** The first great slot from `after` on, within a week, as a local date and time; else 8 pm today. */
export function suggestStart(after: Date, timeZones: string[], timeZone: string) {
  const today = zonedParts(after, timeZone).date;
  for (let day = 0; day < 7; day++) {
    const date = addDays(today, day);
    const slot = hoursOfDay(date, timeZone).find((h) => h > after && rateSlot(h, timeZones) === "great");
    if (slot) return { date, time: zonedParts(slot, timeZone).time };
  }
  return { date: today, time: "20:00" };
}

/** "8:00 pm" in the zone. */
export function formatTime(date: Date, timeZone: string, language: string) {
  return new Intl.DateTimeFormat(language, { hour: "numeric", minute: "2-digit", timeZone }).format(date);
}

/** "8 pm", or "8:30 pm" off the hour (zones like UTC+9:30 are), for tight spaces. */
export function formatShortTime(date: Date, timeZone: string, language: string) {
  const onTheHour = zonedParts(date, timeZone).minute === 0;
  return new Intl.DateTimeFormat(language, { hour: "numeric", ...(!onTheHour && { minute: "2-digit" }), timeZone }).format(date);
}

/** "Sat" in the zone. */
export function formatWeekday(date: Date, timeZone: string, language: string) {
  return new Intl.DateTimeFormat(language, { weekday: "short", timeZone }).format(date);
}

/** "Sat 7 Nov" in the zone. */
export function formatDay(date: Date, timeZone: string, language: string) {
  return new Intl.DateTimeFormat(language, { weekday: "short", day: "numeric", month: "short", timeZone }).format(date);
}

/** "Saturday 7 November" in the zone. */
export function formatDayLong(date: Date, timeZone: string, language: string) {
  return new Intl.DateTimeFormat(language, { weekday: "long", day: "numeric", month: "long", timeZone }).format(date);
}

/** "in 3 days", "in 5 hours", "2 hours ago": the nearest whole unit. */
export function formatRelative(date: Date, now: Date, language: string) {
  const minutes = Math.round((date.getTime() - now.getTime()) / 60000);
  const format = new Intl.RelativeTimeFormat(language, { numeric: "auto" });
  if (Math.abs(minutes) < 60) return format.format(minutes, "minute");
  if (Math.abs(minutes) < 48 * 60) return format.format(Math.round(minutes / 60), "hour");
  return format.format(Math.round(minutes / (24 * 60)), "day");
}

/** iCalendar text values escape backslashes, semicolons, commas and newlines. */
function icsText(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** "20261107T090000Z" */
function icsTime(date: Date) {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/** Lines longer than 75 bytes continue on the next line after a space, without splitting a character. */
function fold(line: string) {
  const encoder = new TextEncoder();
  const lines = [""];
  let bytes = 0;
  for (const char of line) {
    const size = encoder.encode(char).length;
    if (bytes + size > 75) {
      lines.push(" ");
      bytes = 1;
    }
    lines[lines.length - 1] += char;
    bytes += size;
  }
  return lines.join("\r\n");
}

export type IcsEvent = {
  /** Stable per night, so a calendar replaces the event when the night changes. */
  uid: string;
  start: Date;
  minutes: number;
  summary: string;
  description: string;
  url: string;
  /** When the night last changed, if known. */
  updated?: Date;
};

/** A subscribed feed's name and how often calendar apps should fetch it again. */
export type IcsFeed = { name: string; refreshMinutes: number };

/** How often a subscribed calendar should be fetched again: short, so moved nights show soon. */
export const FEED_REFRESH_MINUTES = 60;
/** A subscribed calendar holds the nights from this many days ago… */
export const FEED_DAYS_BEHIND = 30;
/** …to as far ahead as nights can be planned. */
export const FEED_DAYS_AHEAD = MAX_DAYS_AHEAD;

/**
 * An iCalendar file: one watch night to add to a calendar app, or (with `feed`) a subscribed calendar of
 * all of them. Times are UTC, so each calendar shows them on its own clock.
 */
export function toIcs(events: IcsEvent[], feed?: IcsFeed) {
  const now = icsTime(new Date());
  const minutes = feed && Math.max(1, Math.round(feed.refreshMinutes));
  const refresh = minutes && (minutes % 60 === 0 ? `PT${minutes / 60}H` : `PT${minutes}M`);
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Two Couches//Watch nights//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    ...(feed
      ? [
          `NAME:${icsText(feed.name)}`,
          `X-WR-CALNAME:${icsText(feed.name)}`,
          `REFRESH-INTERVAL;VALUE=DURATION:${refresh}`,
          `X-PUBLISHED-TTL:${refresh}`,
        ]
      : []),
    ...events.flatMap((event) => [
      "BEGIN:VEVENT",
      `UID:${event.uid}`,
      `DTSTAMP:${now}`,
      ...(event.updated ? [`LAST-MODIFIED:${icsTime(event.updated)}`] : []),
      `DTSTART:${icsTime(event.start)}`,
      `DTEND:${icsTime(new Date(event.start.getTime() + event.minutes * 60000))}`,
      `SUMMARY:${icsText(event.summary)}`,
      `DESCRIPTION:${icsText(event.description)}`,
      `URL:${event.url}`,
      "END:VEVENT",
    ]),
    "END:VCALENDAR",
  ]
    .map(fold)
    .join("\r\n");
}
