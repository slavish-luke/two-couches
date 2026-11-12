import "server-only";
import { criticScores, type CriticScores, type OmdbTitle } from "./omdb-rules";
import { getImdbId } from "./people";
import type { TitleRef } from "./watch";

// Critic scores from OMDb (Sprint 23): IMDb, Rotten Tomatoes and Metacritic, looked up by the title's IMDb ID.
// Server only (the key never reaches the browser). The free key allows 1,000 requests a day, so every answer
// is kept for a day in Next's fetch cache; only 200s are kept, so a "limit reached" (401) is asked again.

const OMDB = "https://www.omdbapi.com/";
const DAY = 24 * 60 * 60;

/** Whether OMDb is set up. Without a key the title page shows no scores at all. */
export function omdbConfigured() {
  return Boolean(process.env.OMDB_API_KEY);
}

/**
 * A title's critic scores, or null when OMDb isn't set up, TMDB has no IMDb ID for it, or OMDb has no
 * scores for it. Never throws: the scores are extra, and the title page must load without them.
 */
export async function getCriticScores(ref: TitleRef): Promise<CriticScores | null> {
  const key = process.env.OMDB_API_KEY;
  if (!key) return null;
  try {
    const imdbId = await getImdbId(ref);
    if (!imdbId) return null;
    const url = new URL(OMDB);
    url.searchParams.set("i", imdbId);
    url.searchParams.set("apikey", key);
    const res = await fetch(url, { headers: { Accept: "application/json" }, next: { revalidate: DAY } });
    if (!res.ok) throw new Error(`OMDb responded ${res.status}`);
    return criticScores((await res.json()) as OmdbTitle, imdbId);
  } catch (error) {
    console.error("Loading critic scores failed", error instanceof Error ? error.message : error);
    return null;
  }
}
