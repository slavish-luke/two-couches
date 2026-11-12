/** "For you" scoring. Pure functions, safe in server and client code. */
import type { ListStatus } from "./list-rules";
import { titleKey, type TitleRef, type Verdict } from "./watch";

/** A title on the couple's list, as a source of suggestions. */
export type SeedSource = TitleRef & {
  status: ListStatus;
  /** Rating (1-5) by profile ID. */
  ratings: Record<string, number>;
  title: string;
  genre_ids: number[];
};

export type Seed = SeedSource & { weight: number };

/** What an unrated title says: watching or finishing it is a mild yes, dropping it a no, "someday" barely a yes. */
const UNRATED_WEIGHT: Record<ListStatus, number> = { watched: 0.5, watching: 0.5, want: 0.25, dropped: -1, someday: 0.1 };

/**
 * How much a list title should pull suggestions towards (or, below zero, away from) things like it. Each
 * rating counts from the middle (5★ +2 … 1★ −2), so a title one of you loved and the other hated cancels
 * out, and one you both rated 4★ or more gets a bonus: it learns what you share, not one person's taste.
 */
export function seedWeight(item: Pick<SeedSource, "status" | "ratings">) {
  const ratings = Object.values(item.ratings);
  if (ratings.length === 0) return UNRATED_WEIGHT[item.status];
  const weight = ratings.reduce((sum, r) => sum + (r - 3), 0);
  return ratings.length >= 2 && ratings.every((r) => r >= 4) ? weight + 1 : weight;
}

/**
 * The titles that say most about the couple's taste: the strongest likes and dislikes, keeping list
 * order (newest first) between equals. Each one is a TMDB call, so there's a limit.
 */
export function pickSeeds<T extends SeedSource>(items: T[], { likes = 10, dislikes = 4 } = {}): (T & { weight: number })[] {
  const weighed = items.map((item) => ({ ...item, weight: seedWeight(item) }));
  const strongest = (list: typeof weighed) => list.toSorted((a, b) => Math.abs(b.weight) - Math.abs(a.weight));
  return [
    ...strongest(weighed.filter((s) => s.weight > 0)).slice(0, likes),
    ...strongest(weighed.filter((s) => s.weight < 0)).slice(0, dislikes),
  ];
}

/** A title TMDB recommends, with what scoring needs. */
export type Candidate = TitleRef & { release_date: string | null; genre_ids: number[]; vote_average: number };

export type Suggestion<C extends Candidate> = C & {
  score: number;
  /** The liked title that did most to suggest it. */
  because: Seed;
};

/** Each genre's share of the liked titles' weight, 0 to 1. */
function genreProfile(seeds: Seed[]) {
  const liked = seeds.filter((s) => s.weight > 0);
  const total = liked.reduce((sum, s) => sum + s.weight, 0);
  const profile = new Map<number, number>();
  for (const seed of liked) {
    for (const genre of seed.genre_ids) profile.set(genre, (profile.get(genre) ?? 0) + seed.weight / total);
  }
  return profile;
}

/**
 * Scores TMDB's recommendations for each seed. A candidate scores for every liked title that suggests it
 * (more for strong likes and for being high in TMDB's list) and loses for disliked ones; then it gains
 * for sharing genres with what you like and for TMDB's rating. Leaves out `exclude` (titleKey()s: your
 * list and dismissed titles), anything not released by `today`, and anything without a net like behind it.
 */
export function scoreSuggestions<C extends Candidate>(
  sources: { seed: Seed; results: C[] }[],
  exclude: Set<string>,
  today: string,
): Suggestion<C>[] {
  const profile = genreProfile(sources.map((s) => s.seed));
  const found = new Map<string, { candidate: C; evidence: number; because: Seed; best: number }>();

  for (const { seed, results } of sources) {
    results.forEach((candidate, rank) => {
      const key = titleKey(candidate);
      if (exclude.has(key) || !candidate.release_date || candidate.release_date > today) return;
      // The top result counts fully, the last about half.
      const contribution = seed.weight * (1 - rank / (2 * results.length));
      const entry = found.get(key) ?? { candidate, evidence: 0, because: seed, best: -Infinity };
      entry.evidence += contribution;
      if (contribution > entry.best) Object.assign(entry, { because: seed, best: contribution });
      found.set(key, entry);
    });
  }

  return [...found.values()]
    .filter((entry) => entry.evidence > 0 && entry.best > 0)
    .map(({ candidate, evidence, because }) => {
      const genreFit = Math.min(
        1,
        candidate.genre_ids.reduce((sum, g) => sum + (profile.get(g) ?? 0), 0),
      );
      const score = evidence + 0.75 * genreFit + 0.5 * (candidate.vote_average / 10);
      return { ...candidate, score, because };
    })
    .sort((a, b) => b.score - a.score);
}

/** Being watchable for both of you counts for most; for one of you, or free, a little. */
const VERDICT_BOOST: Record<Verdict, number> = { both: 1.5, me: 1.15, partner: 1.15, free: 1.1, none: 1 };

/** Re-orders suggestions by who can watch them (see whoCanWatch()), best first. */
export function rankForCouple<C extends Candidate>(suggestions: Suggestion<C>[], verdictOf: (s: Suggestion<C>) => Verdict) {
  return suggestions
    .map((s) => ({ s, score: s.score * VERDICT_BOOST[verdictOf(s)] }))
    .sort((a, b) => b.score - a.score)
    .map(({ s }) => s);
}
