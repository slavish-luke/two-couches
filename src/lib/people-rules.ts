/**
 * Cast and crew (Sprint 23): which people a title page shows, and which titles a person's page lists.
 * Pure functions over TMDB's credits, safe in server and client code.
 */
import type { MediaType } from "./watch";

/** How many of the cast a title page shows, in TMDB's billing order. */
export const CAST_SHOWN = 10;
/** How many films and series a person's page lists, best known first. */
export const PERSON_TITLES = 40;
/** How many of those get who-can-watch tabs in the first batch (getAvailability() checks 20 at a time). */
export const PERSON_FIRST_BATCH = 20;

/** TMDB's genres for talk shows, news and reality TV: appearances as themselves, not roles. */
const NOT_ROLES = new Set([10763, 10764, 10767]);
/** A "character" that is the person themselves (TMDB writes these in English). */
const SELF = /^(self|himself|herself|themselves|themself)\b/i;

/** Someone on a title page: their name, photo and part (a character, or null for crew). */
export type CreditPerson = { id: number; name: string; profile_path: string | null; character: string | null };

/** /movie/{id}/credits. */
export type MovieCredits = {
  cast?: { id: number; name: string; profile_path: string | null; character?: string; order?: number }[];
  crew?: { id: number; name: string; profile_path: string | null; job?: string }[];
};

/** /tv/{id}/aggregate_credits: every season's cast, each with their roles. */
export type TvCredits = {
  cast?: {
    id: number;
    name: string;
    profile_path: string | null;
    order?: number;
    total_episode_count?: number;
    roles?: { character?: string; episode_count?: number }[];
  }[];
};

/** /tv/{id}: who created the series. */
export type TvCreators = { created_by?: { id: number; name: string; profile_path: string | null }[] };

function unique<T extends { id: number }>(people: T[]) {
  const seen = new Set<number>();
  return people.filter((p) => !seen.has(p.id) && seen.add(p.id));
}

const character = (value: string | undefined) => value?.trim() || null;

/** A film's top-billed cast and its directors. */
export function filmCredits(data: MovieCredits): { cast: CreditPerson[]; leads: CreditPerson[] } {
  const cast = unique((data.cast ?? []).toSorted((a, b) => (a.order ?? 999) - (b.order ?? 999)))
    .slice(0, CAST_SHOWN)
    .map((p) => ({ id: p.id, name: p.name, profile_path: p.profile_path, character: character(p.character) }));
  const leads = unique((data.crew ?? []).filter((p) => p.job === "Director")).map((p) => ({
    id: p.id,
    name: p.name,
    profile_path: p.profile_path,
    character: null,
  }));
  return { cast, leads };
}

/** A series' main cast across all its seasons (each with the part they played most) and its creators. */
export function seriesCredits(data: TvCredits, creators: TvCreators): { cast: CreditPerson[]; leads: CreditPerson[] } {
  const cast = unique((data.cast ?? []).toSorted((a, b) => (a.order ?? 999) - (b.order ?? 999)))
    .slice(0, CAST_SHOWN)
    .map((p) => {
      const role = (p.roles ?? []).toSorted((a, b) => (b.episode_count ?? 0) - (a.episode_count ?? 0))[0];
      return { id: p.id, name: p.name, profile_path: p.profile_path, character: character(role?.character) };
    });
  const leads = unique(creators.created_by ?? []).map((p) => ({ id: p.id, name: p.name, profile_path: p.profile_path, character: null }));
  return { cast, leads };
}

/** A film or series in /person/{id}/combined_credits, as cast (character) or crew (department, job). */
export type CombinedCredit = {
  id: number;
  media_type: string;
  title?: string;
  name?: string;
  release_date?: string;
  first_air_date?: string;
  poster_path: string | null;
  vote_count?: number;
  popularity?: number;
  genre_ids?: number[];
  adult?: boolean;
  character?: string;
  department?: string;
  job?: string;
};

/** Crew departments the person page names (anything else is "Crew"). TMDB's department names. */
export const DEPARTMENTS = ["Directing", "Writing", "Production", "Camera", "Editing", "Sound", "Creator"] as const;
export type Department = (typeof DEPARTMENTS)[number] | "Crew";

/** One of a person's titles: what it is, and what they did on it (characters played, crew departments). */
export type PersonTitle = {
  media_type: MediaType;
  tmdb_id: number;
  title: string;
  release_date: string | null;
  poster_path: string | null;
  characters: string[];
  departments: Department[];
  votes: number;
};

const keyOf = (t: { media_type: string; tmdb_id: number }) => `${t.media_type}:${t.tmdb_id}`;

function departmentOf(credit: CombinedCredit): Department {
  if (credit.job === "Director") return "Directing";
  const d = credit.department as Department | undefined;
  return d && (DEPARTMENTS as readonly string[]).includes(d) ? d : "Crew";
}

/**
 * A person's films and series, each once with everything they did on it, best known first (TMDB's vote
 * count, then popularity), at most `limit`. Talk shows, news, reality TV and appearances as themselves are
 * left out: they're not what anyone opens a person's page to find.
 */
export function personTitles(cast: CombinedCredit[], crew: CombinedCredit[], limit = PERSON_TITLES): PersonTitle[] {
  const byTitle = new Map<string, PersonTitle>();
  /** TMDB's popularity, to order titles with the same vote count. */
  const popularity = new Map<string, number>();
  const add = (credit: CombinedCredit, part: { character?: string; department?: Department }) => {
    if (credit.media_type !== "movie" && credit.media_type !== "tv") return;
    if (credit.adult || (credit.genre_ids ?? []).some((g) => NOT_ROLES.has(g))) return;
    const key = keyOf({ media_type: credit.media_type, tmdb_id: credit.id });
    const entry =
      byTitle.get(key) ??
      ({
        media_type: credit.media_type,
        tmdb_id: credit.id,
        title: (credit.media_type === "movie" ? credit.title : credit.name) ?? "",
        release_date: (credit.media_type === "movie" ? credit.release_date : credit.first_air_date) || null,
        poster_path: credit.poster_path,
        characters: [],
        departments: [],
        votes: credit.vote_count ?? 0,
      } satisfies PersonTitle);
    popularity.set(key, credit.popularity ?? 0);
    if (part.character && !entry.characters.includes(part.character)) entry.characters.push(part.character);
    if (part.department && !entry.departments.includes(part.department)) entry.departments.push(part.department);
    byTitle.set(key, entry);
  };
  for (const credit of cast) {
    const role = credit.character?.trim();
    if (role && SELF.test(role)) continue;
    add(credit, { character: role || undefined });
  }
  for (const credit of crew) add(credit, { department: departmentOf(credit) });
  return [...byTitle.values()]
    .filter((t) => t.title)
    .sort((a, b) => b.votes - a.votes || (popularity.get(keyOf(b)) ?? 0) - (popularity.get(keyOf(a)) ?? 0))
    .slice(0, limit);
}

/** A biography split into paragraphs, blank lines dropped. */
export function paragraphs(text: string | null | undefined) {
  return (text ?? "")
    .split(/\n\s*\n|\r\n\s*\r\n/)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}
