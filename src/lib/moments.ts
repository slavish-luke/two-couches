/**
 * Big moments (Sprint 28): which milestones get the confetti, and which ones this device has already
 * celebrated. Rules are pure; the storage helpers are browser only and never throw (private windows and
 * blocked storage just mean a milestone may be celebrated again).
 */

/** A film number worth confetti: the first, every tenth and every 25th ("Film #50 together"). */
export function isFilmMilestone(n: number) {
  return Number.isInteger(n) && n > 0 && (n === 1 || n % 10 === 0 || n % 25 === 0);
}

/** Milestone keys, shared by Home's chip and Stats so each is celebrated once per device wherever it's seen. */
export const milestoneKey = {
  film: (n: number) => `film:${n}`,
  streak: (weeks: number) => `streak:${weeks}`,
  anniversary: (years: number) => `anniversary:${years}`,
  sticker: (id: string) => `sticker:${id}`,
};

/** A streak worth confetti: two weeks or more that is also your best ever (so each new best week). */
export function isNewBestStreak(current: number, best: number) {
  return current >= 2 && current >= best;
}

const STORAGE_KEY = "milestones-seen";
/** Keep the list short: the oldest keys are dropped first. */
const MAX_KEYS = 200;

export type SeenMilestones = { keys: string[]; stickersSeeded: boolean };

export function readSeen(): SeenMilestones {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Partial<SeenMilestones>) : null;
    return {
      keys: Array.isArray(parsed?.keys) ? parsed.keys.filter((k): k is string => typeof k === "string") : [],
      stickersSeeded: parsed?.stickersSeeded === true,
    };
  } catch {
    return { keys: [], stickersSeeded: false };
  }
}

export function writeSeen(seen: SeenMilestones) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ keys: seen.keys.slice(-MAX_KEYS), stickersSeeded: seen.stickersSeeded }));
  } catch {
    // Storage is off: nothing to remember.
  }
}

/**
 * What to celebrate of `items`, updating what's remembered: the first time this device sees any sticker
 * items, the stickers already earned are recorded quietly (old news, not a new milestone).
 */
export function freshMilestones<T extends { id: string; seed?: boolean }>(seen: SeenMilestones, items: T[]): { fresh: T[]; seen: SeenMilestones } {
  const keys = new Set(seen.keys);
  let stickersSeeded = seen.stickersSeeded;
  if (!stickersSeeded && items.some((i) => i.seed)) {
    for (const item of items) if (item.seed) keys.add(item.id);
    stickersSeeded = true;
  }
  return { fresh: items.filter((i) => !keys.has(i.id)), seen: { keys: [...keys], stickersSeeded } };
}
