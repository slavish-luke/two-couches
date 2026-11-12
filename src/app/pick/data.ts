import "server-only";
import { getList } from "@/lib/list";
import { localDate } from "@/lib/list-rules";
import { isMood, type Mood, type PickCandidate, type Swipes } from "@/lib/pick-rules";
import { getForYou } from "@/lib/recommend";
import { createClient } from "@/lib/supabase/server";
import { getOrigins } from "@/lib/time";
import { madeIn } from "@/lib/time-rules";
import { getAvailability, getTitle, settleLimited } from "@/lib/titles";
import { titleKey, whoCanWatch, type Availability, type MediaType, type TitleRef, type Watcher } from "@/lib/watch";

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
      genre_ids: e.genre_ids ?? [],
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
/** With "Made in our countries" on, more are looked up, since most drop out on where they were made. */
const MAX_RUNTIMES_MADE = 30;

/**
 * The For you suggestions for films and series together, best first, with who can watch each and its
 * length. Unless `everything`, only ones you can both watch get their length looked up (the others won't
 * be picked). Throws only when neither type could be loaded.
 *
 * TMDB's recommendations differ a little by language, so they're chosen with both of your locales in a
 * fixed order (the same on both screens, so both get the same picks and the same swipe deck), then named
 * in the viewer's own language.
 *
 * With `origins` (Sprint 22's "Made in our countries"), only suggestions whose TMDB origin country is one of
 * them are kept; that comes with each title's details (getTitle()), so more of them are looked up.
 */
export async function forYouCandidates(
  couple: Couple,
  today: string,
  everything: boolean,
  origins?: string[],
): Promise<PickItem[]> {
  const types: MediaType[] = ["movie", "tv"];
  const shared = couple.locales.toSorted();
  const [found, list] = await Promise.all([
    Promise.allSettled(types.map((type) => getForYou(couple.coupleId, type, shared, today))),
    shared[0] === couple.locales[0] ? null : getList(couple.coupleId, couple.locales),
  ]);
  if (found.every((f) => f.status === "rejected")) throw (found[0] as PromiseRejectedResult).reason;
  const listTitles = new Map(list?.map((e) => [titleKey(e), e.title]));

  const top = found
    .flatMap((f) => (f.status === "fulfilled" ? f.value.suggestions.slice(0, CHECKED_PER_TYPE) : []))
    .sort((a, b) => b.score - a.score);
  const byTitle = await getAvailability(top, couple.countries);
  const checked = top
    .map((s) => ({ s, availability: byTitle[titleKey(s)] ?? {} }))
    .map(({ s, availability }) => ({ s, availability, verdict: whoCanWatch(couple.me, couple.partner, availability).verdict }))
    .filter(({ verdict }) => everything || verdict === "both")
    .slice(0, origins ? MAX_RUNTIMES_MADE : MAX_RUNTIMES);

  const titles = await settleLimited(checked, 8, ({ s }) =>
    getTitle({ media_type: s.media_type, tmdb_id: s.tmdb_id }, couple.locales[0]),
  );
  return checked.flatMap(({ s, availability, verdict }, i): PickItem[] => {
    const outcome = titles[i];
    const title = outcome.status === "fulfilled" ? outcome.value : null;
    if (origins && !madeIn(title?.origin_countries, origins)) return [];
    return [{
      media_type: s.media_type,
      tmdb_id: s.tmdb_id,
      source: "forYou",
      status: null,
      created_at: null,
      runtime: title?.runtime ?? null,
      genre_ids: s.genre_ids,
      verdict,
      title: title?.title ?? s.title,
      poster_path: title?.poster_path ?? s.poster_path,
      release_date: s.release_date,
      season: null,
      episode: null,
      because: listTitles.get(titleKey(s.because)) ?? s.because.title,
      availability,
    }];
  });
}

/**
 * Sprint 22's "Made in our countries": only the candidates whose TMDB origin country is one of `origins`
 * (getOrigins() fills in titles cached before it knew). Titles it can't tell about are left out.
 */
export async function madeInOurs<C extends TitleRef>(candidates: C[], origins: string[], locale: string): Promise<C[]> {
  const byTitle = await getOrigins(candidates, locale);
  return candidates.filter((c) => madeIn(byTitle.get(titleKey(c)), origins));
}

/** Someone whose mood counts: their profile ID and the time zone their day runs in. */
type Person = { id: string; time_zone: string };

/**
 * Each person's mood today, by their own clock (a mood set yesterday has worn off), or null. Both screens
 * work it out the same way, so both see the same pair.
 */
export async function getMoods(coupleId: string, me: Person, partner: Person | null, now: Date) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("moods").select("profile_id, mood, on_day").eq("couple_id", coupleId);
  if (error) throw error;
  const today = (person: Person | null): Mood | null => {
    const row = person && data.find((r) => r.profile_id === person.id);
    return person && row && isMood(row.mood) && row.on_day === localDate(person.time_zone, now) ? row.mood : null;
  };
  return { mine: today(me), theirs: today(partner) };
}

/** A day's swipes in the deck, yours and your partner's (titleKey() → yes or no). */
export async function getSwipes(coupleId: string, day: string, myId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("swipes")
    .select("profile_id, media_type, tmdb_id, liked")
    .eq("couple_id", coupleId)
    .eq("day", day);
  if (error) throw error;
  const mine: Swipes = {};
  const theirs: Swipes = {};
  for (const row of data) (row.profile_id === myId ? mine : theirs)[titleKey(row as TitleRef)] = row.liked;
  return { mine, theirs };
}
