import "server-only";
import { tmdbGet } from "./tmdb";
import type { TitleRef } from "./watch";

/** How many posters the title page's deck holds at most. */
export const DECK_SIZE = 5;

/** Posters change rarely: keep TMDB's list for a day in Next's fetch cache, like the other TMDB lists. */
const REVALIDATE = 24 * 60 * 60;

type ImageList = {
  posters: { file_path: string; iso_639_1: string | null; vote_count: number; vote_average: number }[];
};

/**
 * The poster languages a deck draws from, in order: the viewer's language, then textless posters (null),
 * then, for any other language, English (Turkish posters are on far fewer titles).
 */
function deckLanguages(language: string): (string | null)[] {
  return language === "en" ? ["en", null] : [language, null, "en"];
}

/**
 * The title page's poster deck: TMDB's most-voted posters (`/{type}/{id}/images`) in the viewer's
 * language, then textless ones (then English ones for other languages), at most DECK_SIZE, best first.
 * Cached in Next's fetch cache for 24 hours. Server only; an error gives an empty deck (the page then
 * shows its one poster). The page puts the poster it already shows on top with `deckWith()`.
 */
export async function getPosterDeck(ref: TitleRef, language: string): Promise<string[]> {
  const languages = deckLanguages(language);
  let data: ImageList;
  try {
    data = await tmdbGet<ImageList>(
      `/${ref.media_type}/${ref.tmdb_id}/images`,
      { include_image_language: languages.map((l) => l ?? "null").join(",") },
      { revalidate: REVALIDATE },
    );
  } catch (error) {
    console.error("Fetching posters for the deck failed", error);
    return [];
  }
  const byVotes = (a: ImageList["posters"][number], b: ImageList["posters"][number]) =>
    b.vote_count - a.vote_count || b.vote_average - a.vote_average;
  return languages
    .flatMap((l) => (data.posters ?? []).filter((p) => (p.iso_639_1 ?? null) === l).toSorted(byVotes))
    .map((p) => p.file_path)
    .slice(0, DECK_SIZE);
}

/** The deck's cards, top first: the poster the page already shows (if any), then the deck without it. */
export function deckWith(first: string | null, deck: string[]): string[] {
  return [...new Set([first, ...deck].filter((path): path is string => Boolean(path)))].slice(0, DECK_SIZE);
}
