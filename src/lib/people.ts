import "server-only";
import {
  filmCredits,
  personTitles,
  seriesCredits,
  type CombinedCredit,
  type CreditPerson,
  type MovieCredits,
  type PersonTitle,
  type TvCreators,
  type TvCredits,
} from "./people-rules";
import { tmdbGet, TmdbError } from "./tmdb";
import type { TitleRef } from "./watch";

// Cast and crew (Sprint 23), from TMDB through the server with Next's fetch cache like browse: credits change
// slowly, so a day. Nothing here is stored in Supabase (titles and getTitle() stay as they are).

const DAY = 24 * 60 * 60;
/** The same request (and revalidate) as Home's next episodes and Coming soon, so it shares their cache entry. */
const SERIES_REVALIDATE = 6 * 60 * 60;

/**
 * A title's top-billed cast and who made it: a film's directors, or a series' creators. Names and parts
 * in `locale` (e.g. "en-GB") where TMDB has them. Throws when TMDB can't be asked.
 */
export async function getCredits(ref: TitleRef, locale: string): Promise<{ cast: CreditPerson[]; leads: CreditPerson[] }> {
  if (ref.media_type === "movie") {
    const data = await tmdbGet<MovieCredits>(`/movie/${ref.tmdb_id}/credits`, { language: locale }, { revalidate: DAY });
    return filmCredits(data);
  }
  const [credits, details] = await Promise.all([
    tmdbGet<TvCredits>(`/tv/${ref.tmdb_id}/aggregate_credits`, { language: locale }, { revalidate: DAY }),
    tmdbGet<TvCreators>(`/tv/${ref.tmdb_id}`, {}, { revalidate: SERIES_REVALIDATE }),
  ]);
  return seriesCredits(credits, details);
}

/** A title's IMDb ID (e.g. "tt0903747"), or null if TMDB has none. Throws when TMDB can't be asked. */
export async function getImdbId(ref: TitleRef): Promise<string | null> {
  const data = await tmdbGet<{ imdb_id?: string | null }>(`/${ref.media_type}/${ref.tmdb_id}/external_ids`, {}, { revalidate: DAY });
  return data.imdb_id && /^tt\d{5,10}$/.test(data.imdb_id) ? data.imdb_id : null;
}

type PersonDetails = {
  id: number;
  name: string;
  biography?: string;
  birthday?: string | null;
  deathday?: string | null;
  place_of_birth?: string | null;
  known_for_department?: string;
  profile_path: string | null;
  combined_credits?: { cast?: CombinedCredit[]; crew?: CombinedCredit[] };
};

export type Person = {
  id: number;
  name: string;
  profile_path: string | null;
  /** In the viewer's language, else English (`biographyInEnglish`), else empty. */
  biography: string;
  biographyInEnglish: boolean;
  birthday: string | null;
  deathday: string | null;
  place_of_birth: string | null;
  known_for: string | null;
  /** Their films and series, best known first (personTitles()). */
  titles: PersonTitle[];
};

/**
 * A person on TMDB (/person/{id} with their combined credits), with titles in `locale`. The biography
 * falls back to English where TMDB has none in the viewer's language. Null when TMDB doesn't know them;
 * throws when TMDB can't be asked.
 */
export async function getPerson(id: number, locale: string): Promise<Person | null> {
  let data: PersonDetails;
  try {
    data = await tmdbGet<PersonDetails>(
      `/person/${id}`,
      { language: locale, append_to_response: "combined_credits" },
      { revalidate: DAY },
    );
  } catch (error) {
    if (error instanceof TmdbError && error.status === 404) return null;
    throw error;
  }
  let biography = data.biography?.trim() ?? "";
  let biographyInEnglish = false;
  if (!biography && !locale.startsWith("en")) {
    const english = await tmdbGet<PersonDetails>(`/person/${id}`, { language: "en-US" }, { revalidate: DAY }).catch(() => null);
    biography = english?.biography?.trim() ?? "";
    biographyInEnglish = Boolean(biography);
  }
  return {
    id: data.id,
    name: data.name,
    profile_path: data.profile_path,
    biography,
    biographyInEnglish,
    birthday: data.birthday || null,
    deathday: data.deathday || null,
    place_of_birth: data.place_of_birth || null,
    known_for: data.known_for_department || null,
    titles: personTitles(data.combined_credits?.cast ?? [], data.combined_credits?.crew ?? []),
  };
}
