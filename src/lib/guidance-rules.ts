/** Content guidance on the title page (Sprint 19). Pure functions, safe in server and client code. */

/** TMDB's /movie/{id}/release_dates (films carry their certification on each release). */
export type ReleaseDatesResults = {
  results: { iso_3166_1: string; release_dates: { certification: string; type: number; descriptors?: string[] }[] }[];
};

/** TMDB's /tv/{id}/content_ratings. */
export type ContentRatingsResults = { results: { iso_3166_1: string; rating: string; descriptors?: string[] }[] };

/** One country's age rating, e.g. "15", with any reasons TMDB gives ("violence"). */
export type AgeRating = { rating: string; descriptors: string[] };

// For films, the cinema certification is the one people know; then digital, physical, TV, premiere.
const RELEASE_ORDER = [3, 2, 4, 5, 6, 1];

/** A film's age rating in one country, or null when TMDB has none there. */
export function filmRating(data: ReleaseDatesResults, country: string): AgeRating | null {
  const releases = data.results.find((r) => r.iso_3166_1 === country)?.release_dates ?? [];
  const rated = releases
    .filter((r) => r.certification.trim())
    .toSorted((a, b) => rank(a.type) - rank(b.type));
  const first = rated[0];
  return first ? { rating: first.certification.trim(), descriptors: first.descriptors ?? [] } : null;
}

function rank(type: number) {
  const i = RELEASE_ORDER.indexOf(type);
  return i === -1 ? RELEASE_ORDER.length : i;
}

/** A series' age rating in one country, or null when TMDB has none there. */
export function seriesRating(data: ContentRatingsResults, country: string): AgeRating | null {
  const found = data.results.find((r) => r.iso_3166_1 === country && r.rating.trim());
  return found ? { rating: found.rating.trim(), descriptors: found.descriptors ?? [] } : null;
}

/** A TMDB keyword ("topic"), with its English name. */
export type Keyword = { id: number; name: string };

/** The topics on someone's "Warn me about" list that a title is tagged with, in the list's order. */
export function matchingWarnings(titleKeywords: Keyword[], warnList: Keyword[]) {
  const tagged = new Set(titleKeywords.map((k) => k.id));
  return warnList.filter((k) => tagged.has(k.id));
}

/** The most topics one person can keep (the table's trigger says the same). */
export const MAX_WARN_KEYWORDS = 30;

/** A keyword name as it should be stored: trimmed, single-spaced, 1–100 characters; else null. */
export function cleanKeywordName(value: unknown) {
  const name = typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
  return name && name.length <= 100 ? name : null;
}

/** DoesTheDogDie.com's search for a title (no API: a link out). */
export function doesTheDogDieUrl(title: string) {
  return `https://www.doesthedogdie.com/search?q=${encodeURIComponent(title.trim())}`;
}
