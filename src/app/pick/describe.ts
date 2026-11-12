import type { Messages } from "@/lib/i18n";
import { DEFAULT_EPISODE_MIN, lengthOf, type PickCandidate } from "@/lib/pick-rules";

/** How long it takes tonight: "2 h 10 min", "45 min an episode", or "Length unknown". */
export function lengthFor(item: Pick<PickCandidate, "media_type" | "runtime">, t: Messages) {
  const length = lengthOf(item);
  if (length === null) return t.pick.length.unknown;
  if (item.media_type === "movie") return t.pick.length.film(t.title.runtime(length));
  return item.runtime ? t.pick.length.episode(t.title.runtime(length)) : t.pick.length.episodeGuess(t.title.runtime(DEFAULT_EPISODE_MIN));
}

/** The tags under a pick or a swipe card: year, film or series, and how long. */
export function tagsFor(item: Pick<PickCandidate, "media_type" | "runtime"> & { release_date: string | null }, t: Messages) {
  return [item.release_date?.slice(0, 4), t.common.mediaType[item.media_type], lengthFor(item, t)].filter((tag): tag is string => Boolean(tag));
}
