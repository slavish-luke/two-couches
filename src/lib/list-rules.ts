/** Shared-list rules. Pure functions, safe in server and client code. Mirrors the checks on list_items. */

import { dateLocale } from "./places";

export const LIST_STATUSES = ["want", "watching", "watched", "dropped"] as const;

export type ListStatus = (typeof LIST_STATUSES)[number];

export function isListStatus(value: unknown): value is ListStatus {
  return typeof value === "string" && (LIST_STATUSES as readonly string[]).includes(value);
}

export const MAX_CATEGORIES = 10;
export const MAX_CATEGORY_LENGTH = 30;
export const MAX_NOTES_LENGTH = 1000;

/** Trimmed category names without repeats (ignoring case), or null if any is empty, too long or too many. */
export function cleanCategories(values: unknown): string[] | null {
  if (!Array.isArray(values)) return null;
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    if (typeof value !== "string") return null;
    const name = value.trim().replace(/\s+/g, " ");
    if (!name || name.length > MAX_CATEGORY_LENGTH) return null;
    if (seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    result.push(name);
  }
  return result.length <= MAX_CATEGORIES ? result : null;
}

/** Last episode watched. Both set or neither. */
export type Progress = { season: number; episode: number };

export function isProgress(value: unknown): value is Progress {
  if (typeof value !== "object" || value === null) return false;
  const { season, episode } = value as Record<string, unknown>;
  return (
    Number.isSafeInteger(season) && Number.isSafeInteger(episode) && (season as number) > 0 && (episode as number) > 0
  );
}

/**
 * The episode after `progress` (S1 E1 if you hadn't started). With TMDB's episodes per season
 * (`titles.season_episodes`, season 1 first), finishing a season rolls over to the next one's first episode,
 * and finishing the last season gives null. Without them, or past what they know, it's the next number.
 */
export function episodeAfter(progress: Progress | null, seasonEpisodes: number[] | null): Progress | null {
  if (!progress) return { season: 1, episode: 1 };
  const inSeason = seasonEpisodes?.[progress.season - 1];
  if (!seasonEpisodes || !inSeason || progress.episode < inSeason) {
    return { season: progress.season, episode: progress.episode + 1 };
  }
  return progress.season < seasonEpisodes.length ? { season: progress.season + 1, episode: 1 } : null;
}

/** A calendar date ("2026-11-01") in the given time zone. */
export function localDate(timeZone: string, date = new Date()) {
  const parts = new Intl.DateTimeFormat("en", { year: "numeric", month: "2-digit", day: "2-digit", timeZone })
    .formatToParts(date)
    .reduce<Record<string, string>>((acc, p) => ({ ...acc, [p.type]: p.value }), {});
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function isDateString(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));
}

/** "1 Nov 2026" for a calendar date, without shifting it through a time zone. */
export function formatDate(value: string, language: string) {
  return new Intl.DateTimeFormat(dateLocale(language), {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}

/** "14 Nov", with the year when it isn't the same year as `today` (both local dates). */
export function shortDate(value: string, today: string, language: string) {
  if (value.slice(0, 4) !== today.slice(0, 4)) return formatDate(value, language);
  return new Intl.DateTimeFormat(dateLocale(language), { day: "numeric", month: "short", timeZone: "UTC" }).format(
    new Date(`${value}T00:00:00Z`),
  );
}
