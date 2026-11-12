/** Reading OMDb's answer (Sprint 23). Pure, safe in server and client code. */

/** What OMDb returns for one title (only what we read). Missing values are the string "N/A". */
export type OmdbTitle = {
  Response?: string;
  imdbRating?: string;
  imdbVotes?: string;
  Metascore?: string;
  Ratings?: { Source?: string; Value?: string }[];
};

/** Each score as a number on its own scale, or absent. */
export type CriticScores = {
  imdbId: string;
  /** Out of 10, e.g. 8.8, with how many people voted. */
  imdb?: { rating: number; votes: number | null };
  /** The Tomatometer: per cent of critics positive. */
  rottenTomatoes?: number;
  /** Metacritic's Metascore, out of 100. */
  metacritic?: number;
};

function number(value: string | undefined, pattern: RegExp, max: number) {
  const match = value && value !== "N/A" ? pattern.exec(value.trim()) : null;
  const n = match ? Number(match[1].replace(/,/g, "")) : NaN;
  return Number.isFinite(n) && n >= 0 && n <= max ? n : undefined;
}

/**
 * The scores OMDb has for a title, skipping anything "N/A" or malformed, or null when it has none (or
 * doesn't know the title: `Response` "False").
 */
export function criticScores(data: OmdbTitle, imdbId: string): CriticScores | null {
  if (data.Response !== "True") return null;
  const source = (name: string) => data.Ratings?.find((r) => r.Source === name)?.Value;
  const imdbRating = number(data.imdbRating, /^(\d+(?:\.\d)?)$/, 10) ?? number(source("Internet Movie Database"), /^(\d+(?:\.\d)?)\/10$/, 10);
  const votes = number(data.imdbVotes, /^([\d,]+)$/, Number.MAX_SAFE_INTEGER);
  const rottenTomatoes = number(source("Rotten Tomatoes"), /^(\d{1,3})%$/, 100);
  const metacritic = number(data.Metascore, /^(\d{1,3})$/, 100) ?? number(source("Metacritic"), /^(\d{1,3})\/100$/, 100);
  const scores: CriticScores = { imdbId };
  if (imdbRating !== undefined) scores.imdb = { rating: imdbRating, votes: votes ?? null };
  if (rottenTomatoes !== undefined) scores.rottenTomatoes = rottenTomatoes;
  if (metacritic !== undefined) scores.metacritic = metacritic;
  return scores.imdb || scores.rottenTomatoes !== undefined || scores.metacritic !== undefined ? scores : null;
}
