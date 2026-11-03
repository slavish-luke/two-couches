import "server-only";
import { getList } from "@/lib/list";
import type { PickCandidate } from "@/lib/pick-rules";
import { getForYou } from "@/lib/recommend";
import { getAvailability, getTitle, settleLimited } from "@/lib/titles";
import { titleKey, whoCanWatch, type Availability, type MediaType, type Watcher } from "@/lib/watch";

/** A candidate with what the pick card shows. */
export type PickItem = PickCandidate & {
  title: string;
  poster_path: string | null;
  release_date: string | null;
  season: number | null;
  episode: number | null;
  /** For you: the liked title that led to it. */
  because: string | null;
  availability: Availability;
};

type Couple = { coupleId: string; locales: string[]; countries: string[]; me: Watcher; partner: Watcher | null };

/** Up next (want and watching), with who can watch each. */
export async function listCandidates(couple: Couple): Promise<PickItem[]> {
  const entries = (await getList(couple.coupleId, couple.locales)).filter(
    (e) => e.status === "want" || e.status === "watching",
  );
  const byTitle = await getAvailability(entries, couple.countries);
  return entries.map((e) => {
    const availability = byTitle[titleKey(e)] ?? {};
    return {
      media_type: e.media_type,
      tmdb_id: e.tmdb_id,
      source: "list",
      status: e.status,
      created_at: e.created_at,
      runtime: e.runtime,
      verdict: whoCanWatch(couple.me, couple.partner, availability).verdict,
      title: e.title,
      poster_path: e.poster_path,
      release_date: e.release_date,
      season: e.season,
      episode: e.episode,
      because: null,
      availability,
    };
  });
}

/** How many of each type's best suggestions are checked for who can watch them. */
const CHECKED_PER_TYPE = 15;
/** At most this many suggestions get their runtime looked up (one TMDB call each the first time). */
const MAX_RUNTIMES = 16;

/**
 * The For you suggestions for films and series together, best first, with who can watch each and its
 * length. Unless `everything`, only ones you can both watch get their length looked up (the others won't
 * be picked). Throws only when neither type could be loaded.
 */
export async function forYouCandidates(couple: Couple, today: string, everything: boolean): Promise<PickItem[]> {
  const types: MediaType[] = ["movie", "tv"];
  const found = await Promise.allSettled(types.map((type) => getForYou(couple.coupleId, type, couple.locales, today)));
  if (found.every((f) => f.status === "rejected")) throw (found[0] as PromiseRejectedResult).reason;

  const top = found
    .flatMap((f) => (f.status === "fulfilled" ? f.value.suggestions.slice(0, CHECKED_PER_TYPE) : []))
    .sort((a, b) => b.score - a.score);
  const byTitle = await getAvailability(top, couple.countries);
  const checked = top
    .map((s) => ({ s, availability: byTitle[titleKey(s)] ?? {} }))
    .map(({ s, availability }) => ({ s, availability, verdict: whoCanWatch(couple.me, couple.partner, availability).verdict }))
    .filter(({ verdict }) => everything || verdict === "both")
    .slice(0, MAX_RUNTIMES);

  const titles = await settleLimited(checked, 8, ({ s }) =>
    getTitle({ media_type: s.media_type, tmdb_id: s.tmdb_id }, couple.locales[0]),
  );
  return checked.map(({ s, availability, verdict }, i) => {
    const outcome = titles[i];
    const title = outcome.status === "fulfilled" ? outcome.value : null;
    return {
      media_type: s.media_type,
      tmdb_id: s.tmdb_id,
      source: "forYou",
      status: null,
      created_at: null,
      runtime: title?.runtime ?? null,
      verdict,
      title: s.title,
      poster_path: title?.poster_path ?? s.poster_path,
      release_date: s.release_date,
      season: null,
      episode: null,
      because: s.because.title,
      availability,
    };
  });
}
