/** Stats for the couple's list ("your year in movies"). Pure functions, safe in server and client code. */
import { localDate, type ListStatus } from "./list-rules";
import type { MediaType } from "./watch";

/** The parts of a list entry the stats use (ListEntry in list.ts has them all). */
export type StatsEntry = {
  id: string;
  media_type: MediaType;
  tmdb_id: number;
  title: string;
  poster_path: string | null;
  status: ListStatus;
  watched_on: string | null;
  added_by: string | null;
  created_at: string;
  genre_ids: number[];
  runtime: number | null;
  episodes: number | null;
  ratings: Record<string, number>;
};

/** A year ("2026"), or every year. */
export type Period = number | "all";

export type Stats = {
  films: number;
  series: number;
  /** Films' runtimes plus each finished series' episodes × typical episode length. */
  minutes: number;
  /** True when some titles had no runtime (or episode count), so `minutes` is a lower bound. */
  minutesIncomplete: boolean;
  /** Watch nights that have started. */
  nights: number;
  /** Most-watched genres, most first (ties by ID, so the order is stable). */
  genres: { id: number; count: number }[];
  /** Titles finished each month, January first. Only for a year. */
  months: number[] | null;
  /** Titles each of you added to the list in the period. */
  added: { me: number; partner: number };
  /** Average rating of what was watched, per person, or null without ratings. */
  averages: { me: number | null; partner: number | null };
  /** Up to three titles you both rated, highest combined rating first. */
  favourites: StatsEntry[];
  /** The title your ratings differ on most (by 2★ or more), if any. */
  split: StatsEntry | null;
  /** Rewatches in the period (Sprint 18), already counted in films, series, minutes and months. */
  rewatches: { films: number; series: number };
};

/** A rewatch as the stats count it: which list item, and when (a local date). */
export type StatsRewatch = { list_item_id: string; watched_on: string };

const TOP_GENRES = 5;

/** Years with something watched, newest first, always including this year. */
export function statsYears(entries: StatsEntry[], thisYear: number, rewatches: StatsRewatch[] = []) {
  const years = new Set([thisYear]);
  for (const e of entries) if (e.status === "watched" && e.watched_on) years.add(Number(e.watched_on.slice(0, 4)));
  for (const r of rewatches) years.add(Number(r.watched_on.slice(0, 4)));
  return [...years].sort((a, b) => b - a);
}

function average(values: number[]) {
  return values.length ? values.reduce((sum, v) => sum + v, 0) / values.length : null;
}

/**
 * The stats for one period. "Watched" means status watched; a year counts what was watched that year
 * (by watched_on, a local date) and what was added that year in `timeZone`. Watch nights are UTC times.
 */
export function computeStats(
  entries: StatsEntry[],
  nightStarts: string[],
  {
    period,
    meId,
    partnerId,
    timeZone,
    now,
    rewatches = [],
  }: { period: Period; meId: string; partnerId: string | null; timeZone: string; now: Date; rewatches?: StatsRewatch[] },
): Stats {
  const inYear = (date: string | null) => period === "all" || (date !== null && Number(date.slice(0, 4)) === period);
  const watched = entries.filter((e) => e.status === "watched" && (period === "all" || inYear(e.watched_on)));
  // Each rewatch in the period counts as one more watch of its title (on its own date), whatever year the
  // first watch was in.
  const byId = new Map(entries.map((e) => [e.id, e]));
  const again = rewatches.flatMap((r) => {
    const entry = byId.get(r.list_item_id);
    return entry && inYear(r.watched_on) ? [{ entry, watched_on: r.watched_on }] : [];
  });
  const watches = [...watched.map((entry) => ({ entry, watched_on: entry.watched_on })), ...again];

  let minutes = 0;
  let minutesIncomplete = false;
  for (const { entry: e } of watches) {
    const length = e.media_type === "movie" ? e.runtime : e.runtime && e.episodes ? e.runtime * e.episodes : null;
    if (length) minutes += length;
    else minutesIncomplete = true;
  }

  const genreCounts = new Map<number, number>();
  for (const e of watched) for (const id of e.genre_ids) genreCounts.set(id, (genreCounts.get(id) ?? 0) + 1);
  const genres = [...genreCounts]
    .map(([id, count]) => ({ id, count }))
    .sort((a, b) => b.count - a.count || a.id - b.id)
    .slice(0, TOP_GENRES);

  let months: number[] | null = null;
  if (period !== "all") {
    months = Array.from({ length: 12 }, () => 0);
    for (const w of watches) if (w.watched_on) months[Number(w.watched_on.slice(5, 7)) - 1]++;
  }

  const addedInPeriod = entries.filter((e) => inYear(localDate(timeZone, new Date(e.created_at))));
  const added = {
    me: addedInPeriod.filter((e) => e.added_by === meId).length,
    partner: partnerId ? addedInPeriod.filter((e) => e.added_by === partnerId).length : 0,
  };

  const ratingsOf = (id: string | null) =>
    id ? watched.flatMap((e) => (e.ratings[id] ? [e.ratings[id]] : [])) : [];
  const bothRated = partnerId ? watched.filter((e) => e.ratings[meId] && e.ratings[partnerId]) : [];
  const combined = (e: StatsEntry) => e.ratings[meId] + e.ratings[partnerId!];
  const gap = (e: StatsEntry) => Math.abs(e.ratings[meId] - e.ratings[partnerId!]);
  const byWatched = (a: StatsEntry, b: StatsEntry) => (b.watched_on ?? "").localeCompare(a.watched_on ?? "");
  const split = bothRated.filter((e) => gap(e) >= 2).sort((a, b) => gap(b) - gap(a) || byWatched(a, b))[0] ?? null;

  return {
    films: watches.filter((w) => w.entry.media_type === "movie").length,
    series: watches.filter((w) => w.entry.media_type === "tv").length,
    minutes,
    minutesIncomplete,
    nights: nightStarts.filter((at) => Date.parse(at) <= now.getTime() && inYear(localDate(timeZone, new Date(at)))).length,
    genres,
    months,
    added,
    averages: { me: average(ratingsOf(meId)), partner: average(ratingsOf(partnerId)) },
    favourites: bothRated
      .filter((e) => combined(e) >= 7)
      .sort((a, b) => combined(b) - combined(a) || byWatched(a, b))
      .slice(0, 3),
    split,
    rewatches: {
      films: again.filter((w) => w.entry.media_type === "movie").length,
      series: again.filter((w) => w.entry.media_type === "tv").length,
    },
  };
}
