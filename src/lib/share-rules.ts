/**
 * The share sheet (Sprint 18): finding the film or series in what another app shared with Two Couches
 * (`title`, `text` and `url` from the manifest's share_target). Pure functions, safe in server and client code.
 */
import { isMediaType, type TitleRef } from "./watch";

export type SharedLookup =
  /** An IMDb link or ID: look it up with TMDB's /find. */
  | { kind: "imdb"; id: string }
  /** A TMDB link: the title itself. */
  | { kind: "tmdb"; ref: TitleRef }
  /** Anything else: search for these words, preferring results from `year`. */
  | { kind: "search"; query: string; year: number | null };

/** Longest search kept from a share. */
export const MAX_SHARED_QUERY = 100;

const IMDB = /\b(tt\d{5,10})\b/;
const TMDB = /themoviedb\.org\/(movie|tv)\/(\d{1,9})/i;
/** letterboxd.com/film/the-thing-1982/ (also under a member's name: letterboxd.com/sam/film/…). */
const LETTERBOXD = /letterboxd\.com\/(?:[\w.-]+\/)?film\/([a-z0-9-]+)/i;
/** justwatch.com/uk/movie/the-matrix (the slug is the title in the site's language). */
const JUSTWATCH = /justwatch\.com\/[a-z]{2}\/[a-z-]+\/([a-z0-9-]+)/i;
const URLS =/\bhttps?:\/\/\S+/gi;

/** "The Matrix (1999) - IMDb" → "The Matrix" and 1999: the year in brackets, the site's name after a dash or bar dropped. */
function cleanTitle(text: string): { query: string; year: number | null } {
  const withoutLinks = text.replace(URLS, " ");
  const bracketYear = withoutLinks.match(/\((?:[^)]*?\s)?((?:18|19|20)\d{2})\)/);
  const query = withoutLinks
    .replace(/\([^)]*\)/g, " ")
    // "… - IMDb", "… | Netflix", "… on Letterboxd": keep what comes first.
    .split(/\s[-–—|•·]\s|\s+on\s+(?:Letterboxd|IMDb|JustWatch|Netflix|TMDB)\b/i)[0]
    .replace(/["“”«»]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_SHARED_QUERY);
  return { query, year: bracketYear ? Number(bracketYear[1]) : null };
}

/**
 * What to look up for a share, or null when nothing useful came with it. Links win over words: an IMDb ID
 * anywhere, then a TMDB link, then a Letterboxd film link (its slug as a search, with the year Letterboxd
 * adds to tell films apart), then the shared title or text as a search.
 */
export function readShared(shared: { title?: string | null; text?: string | null; url?: string | null }): SharedLookup | null {
  const parts = [shared.url, shared.text, shared.title].map((p) => (p ?? "").slice(0, 2000));
  const all = parts.join(" ");

  const imdb = all.match(IMDB);
  if (imdb) return { kind: "imdb", id: imdb[1] };

  const tmdb = all.match(TMDB);
  if (tmdb && isMediaType(tmdb[1].toLowerCase())) {
    return { kind: "tmdb", ref: { media_type: tmdb[1].toLowerCase() as TitleRef["media_type"], tmdb_id: Number(tmdb[2]) } };
  }

  const letterboxd = all.match(LETTERBOXD);
  if (letterboxd) {
    const slug = letterboxd[1].toLowerCase();
    const year = slug.match(/-((?:18|19|20)\d{2})$/);
    const words = (year ? slug.slice(0, -5) : slug).replace(/-/g, " ").trim();
    if (words) return { kind: "search", query: words.slice(0, MAX_SHARED_QUERY), year: year ? Number(year[1]) : null };
  }

  const justWatch = all.match(JUSTWATCH);
  if (justWatch) return { kind: "search", query: justWatch[1].replace(/-/g, " ").slice(0, MAX_SHARED_QUERY), year: null };

  for (const text of [shared.title, shared.text]) {
    if (!text) continue;
    const { query, year } = cleanTitle(text.slice(0, 2000));
    if (query) return { kind: "search", query, year };
  }
  return null;
}

/** Search results with the shared year's first (TMDB's order otherwise). */
export function preferYear<T extends { release_date: string | null }>(results: T[], year: number | null): T[] {
  if (!year) return results;
  const inYear = (r: T) => Number(r.release_date?.slice(0, 4)) === year;
  return [...results.filter(inYear), ...results.filter((r) => !inYear(r))];
}

/** What was shared, for the page to quote back: the title or text, else the link, shortened. */
export function sharedSummary(shared: { title?: string | null; text?: string | null; url?: string | null }) {
  const text = [shared.title, shared.text, shared.url].map((p) => p?.trim()).find(Boolean) ?? "";
  return text.length > 140 ? `${text.slice(0, 139)}…` : text;
}
