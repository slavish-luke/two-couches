/** "Pick for tonight" rules: how long you have, what fits, and a seeded order. Pure, safe in server and client code. */
import type { ListStatus } from "./list-rules";
import { fitFor, zonedParts, zonedToUtc } from "./night-rules";
import { titleKey, type TitleRef, type Verdict } from "./watch";

/** A series fits if one episode does; this is an episode's length when TMDB doesn't say. */
export const DEFAULT_EPISODE_MIN = 45;
/** "Until it's too late": whatever you pick has to end before this hour, on both clocks. */
export const LATEST_END = "23:00";
export const MIN_MINUTES = 15;
export const MAX_MINUTES = 600;
/** One-tap choices on the page, in minutes. */
export const QUICK_MINUTES = [90, 120, 150, 180] as const;
/** "Another" stops counting here; the order wraps around long before. */
export const MAX_ANOTHER = 999;

/** How long you have: a number of minutes, or until it's too late for one of you. */
export type TimeChoice = { kind: "minutes"; minutes: number } | { kind: "late" };

/** `?time=120` or `?time=late`, or null for anything else. */
export function parseTimeChoice(value: unknown): TimeChoice | null {
  if (value === "late") return { kind: "late" };
  if (typeof value !== "string" || !/^\d{1,4}$/.test(value)) return null;
  const minutes = Number(value);
  return minutes >= MIN_MINUTES && minutes <= MAX_MINUTES ? { kind: "minutes", minutes } : null;
}

/** `?n=3`: how many times "Another" was pressed. */
export function parseAnother(value: unknown) {
  const n = typeof value === "string" && /^\d{1,3}$/.test(value) ? Number(value) : 0;
  return Math.min(n, MAX_ANOTHER);
}

/**
 * Minutes from `now` until it's too late for the first of you: the earliest of each person's next
 * 23:00, rounded down to 5 minutes so both screens agree for a while. `limitedBy` is the index into
 * `timeZones` of whoever sets the limit. 0 minutes when it's already past 23:00 for someone, or they're
 * asleep (fitFor()), i.e. between midnight and 8 am.
 */
export function minutesUntilLate(now: Date, timeZones: string[]): { minutes: number; limitedBy: number; endsAt: Date } {
  let best = { minutes: Infinity, limitedBy: 0, endsAt: now };
  timeZones.forEach((zone, i) => {
    const local = zonedParts(now, zone);
    const tooLate = fitFor(now, zone) === "asleep" || local.time >= LATEST_END;
    const endsAt = tooLate ? now : zonedToUtc(local.date, LATEST_END, zone);
    const minutes = Math.max(0, Math.floor((endsAt.getTime() - now.getTime()) / 60000 / 5) * 5);
    if (minutes < best.minutes) best = { minutes, limitedBy: i, endsAt };
  });
  return best.minutes === Infinity ? { minutes: 0, limitedBy: 0, endsAt: now } : best;
}

/** Something you could watch tonight: from the list, or from the For you suggestions. */
export type PickCandidate = TitleRef & {
  source: "list" | "forYou";
  /** List titles only: want or watching. */
  status: ListStatus | null;
  /** List titles: when it was added. */
  created_at: string | null;
  /** Minutes: the film, or a typical episode of a series. Null when TMDB doesn't say. */
  runtime: number | null;
  verdict: Verdict;
};

/** How long watching it tonight takes: the film, or one episode (45 min if unknown). Null for a film of unknown length. */
export function lengthOf(c: Pick<PickCandidate, "media_type" | "runtime">) {
  if (c.runtime && c.runtime > 0) return c.runtime;
  return c.media_type === "tv" ? DEFAULT_EPISODE_MIN : null;
}

/** 32-bit FNV-1a, then a final mix, as a number in (0, 1). */
function hashUnit(text: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return ((h >>> 0) + 0.5) / 2 ** 32;
}

/**
 * A weighted shuffle that depends only on `seed` and each item's key, never on the other items, so a
 * tier's order stays the same however the tiers after it change (Efraimidis–Spirakis: u^(1/weight)).
 */
export function seededShuffle<T>(items: T[], seed: string, key: (item: T) => string, weight: (item: T) => number) {
  return items
    .map((item) => ({ item, rank: Math.log(hashUnit(`${seed}|${key(item)}`)) / Math.max(weight(item), 0.01) }))
    .sort((a, b) => b.rank - a.rank)
    .map(({ item }) => item);
}

/** In progress counts for most; between titles you want, the longer it's waited, the more it counts (up to double). */
function listWeight(c: PickCandidate, ageRank: number, count: number) {
  return (c.status === "watching" ? 4 : 1) * (1 + ageRank / Math.max(count - 1, 1));
}

/** Suggestions in For you order (best first) count from double down to just over one. */
function forYouWeight(index: number, count: number) {
  return 2 - index / Math.max(count, 1);
}

/**
 * Everything that fits in `minutes`, in the order to suggest it. Leaves out anything longer, and unless
 * `everything`, anything you can't both watch (whoCanWatch()). The order is in tiers: list titles of
 * known length, then For you suggestions of known length, then films of unknown length (list, then For
 * you). Within a tier it's a seeded weighted shuffle: titles you're watching and older adds come up more
 * often (list), better suggestions more often (For you), and with `everything` on, ones you can both
 * watch twice as often. The same seed, list and suggestions always give the same order.
 */
export function pickOrder<C extends PickCandidate>(
  candidates: C[],
  { minutes, everything, seed }: { minutes: number; everything: boolean; seed: string },
): C[] {
  const seen = new Set<string>();
  const kept = candidates.filter((c) => {
    const key = titleKey(c);
    if (seen.has(key)) return false;
    seen.add(key);
    const length = lengthOf(c);
    return (everything || c.verdict === "both") && (length === null || length <= minutes);
  });

  const list = kept.filter((c) => c.source === "list");
  // Newest first, so the newest add has age rank 0 and the oldest the highest.
  const byAge = new Map(
    list.toSorted((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? "")).map((c, i) => [titleKey(c), i]),
  );
  const forYou = kept.filter((c) => c.source === "forYou");
  const forYouIndex = new Map(forYou.map((c, i) => [titleKey(c), i]));
  const bothBoost = (c: C) => (everything && c.verdict === "both" ? 2 : 1);
  const weight = (c: C) =>
    bothBoost(c) *
    (c.source === "list"
      ? listWeight(c, byAge.get(titleKey(c)) ?? 0, list.length)
      : forYouWeight(forYouIndex.get(titleKey(c)) ?? 0, forYou.length));

  const known = (c: C) => lengthOf(c) !== null;
  const tiers = [
    list.filter(known),
    forYou.filter(known),
    list.filter((c) => !known(c)),
    forYou.filter((c) => !known(c)),
  ];
  return tiers.flatMap((tier) => seededShuffle(tier, seed, titleKey, weight));
}

/** How many of the first picks come from the list alone, so For you only needs loading after them. */
export function listOnlyCount(candidates: PickCandidate[], options: { minutes: number; everything: boolean }) {
  return pickOrder(
    candidates.filter((c) => c.source === "list"),
    { ...options, seed: "" },
  ).filter((c) => lengthOf(c) !== null).length;
}

/**
 * The pick after `another` presses of "Another", going round again after the last one. `round` is 0 the
 * first time through. Null when nothing fits.
 */
export function pickAt<C>(order: C[], another: number): { pick: C; round: number; position: number } | null {
  if (order.length === 0) return null;
  return { pick: order[another % order.length], round: Math.floor(another / order.length), position: another % order.length };
}

/** The seed for a day: the UTC date, so both of you get the same picks wherever you are. */
export function daySeed(now: Date) {
  return now.toISOString().slice(0, 10);
}
