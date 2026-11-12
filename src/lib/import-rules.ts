/**
 * "Bring in your history" (Sprint 18): reading Letterboxd and IMDb CSV exports in the browser, and the
 * shapes the import's Server Actions take. Pure functions, safe in server and client code.
 */
import { isDateString } from "./list-rules";
import type { MediaType, TitleRef } from "./watch";

/** Titles per import, after merging the files. */
export const MAX_IMPORT_ROWS = 1000;
/** Titles the browser sends to be looked up per Server Action call (the server checks 20 at a time on TMDB). */
export const MATCH_BATCH = 40;
/** Titles added per Server Action call (each is cached in both partners' languages first). */
export const IMPORT_BATCH = 20;

/**
 * Rows of a CSV file: commas between fields, double quotes around fields that hold commas, quotes ("" for
 * one) or line breaks, CRLF or LF line ends, an optional byte-order mark. Blank lines are dropped.
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const input = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  for (let i = 0; i < input.length; i++) {
    const c = input[i];
    if (quoted) {
      if (c === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += c;
    } else if (c === '"' && field === "") quoted = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && input[i + 1] === "\n") i++;
      row.push(field);
      if (row.some((f) => f !== "")) rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  row.push(field);
  if (row.some((f) => f !== "")) rows.push(row);
  return rows;
}

export type ImportSource = "letterboxd" | "imdb";
/** Where an imported title goes: Up next, or Watched. */
export type ImportStatus = "want" | "watched";

/** One title from an export, as the import works with it. */
export type ImportRow = {
  /** Identifies the title across files: the IMDb ID, the Letterboxd link, or name and year. */
  key: string;
  source: ImportSource;
  name: string;
  year: number | null;
  /** IMDb's tt… ID, when the export has it. */
  imdb: string | null;
  /** What IMDb calls it (Letterboxd is all films). */
  type: MediaType | null;
  status: ImportStatus;
  /** Your rating in whole stars, 1-5. */
  rating: number | null;
  /** True when the export's rating had to be rounded to whole stars. */
  rounded: boolean;
  /** When you watched (or rated) it, a local date. */
  watchedOn: string | null;
};

/** Letterboxd's 0.5-5 stars to whole stars (halves round up, half a star becomes 1). */
export function starsFromLetterboxd(value: number) {
  return Math.min(5, Math.max(1, Math.round(value)));
}

/** IMDb's 1-10 to whole stars: halved, then rounded (halves up), so 1 is 1★ and 10 is 5★. */
export function starsFromImdb(value: number) {
  return Math.min(5, Math.max(1, Math.round(value / 2)));
}

const IMDB_ID = /^tt\d{5,10}$/;

/** IMDb's "Title Type" to ours; null for what can't go on the list (episodes, games, podcasts). */
function imdbType(value: string): MediaType | null | "skip" {
  const type = value.toLowerCase().replace(/[\s_-]/g, "");
  if (!type) return null;
  if (type.includes("episode") || type.includes("game") || type.includes("podcast")) return "skip";
  if (type.includes("series")) return "tv";
  return "movie";
}

function yearOf(value: string | undefined) {
  const year = Number(value?.trim());
  return Number.isInteger(year) && year > 1800 && year < 3000 ? year : null;
}

function dateOf(value: string | undefined) {
  const date = value?.trim().slice(0, 10);
  return date && isDateString(date) ? date : null;
}

/**
 * The titles in one export file, or null when it isn't a Letterboxd or IMDb export. Letterboxd files are
 * told apart by name (watchlist.csv goes to Up next) and columns (a Rating column means rated, so watched).
 * IMDb rows with your rating are watched; the rest (a watchlist) go to Up next. Episodes are left out.
 */
export function readExport(fileName: string, text: string): ImportRow[] | null {
  const [header, ...rows] = parseCsv(text);
  if (!header) return null;
  const columns = header.map((h) => h.trim().toLowerCase());
  const col = (name: string) => columns.indexOf(name);

  if (col("letterboxd uri") >= 0 && col("name") >= 0) {
    const watchlist = /watchlist/i.test(fileName);
    const [name, year, uri, rating, date, watched] = ["name", "year", "letterboxd uri", "rating", "date", "watched date"].map(col);
    return rows.flatMap((cells) => {
      const title = cells[name]?.trim();
      if (!title) return [];
      const stars = rating >= 0 && cells[rating]?.trim() ? Number(cells[rating]) : NaN;
      const rated = Number.isFinite(stars) && stars > 0;
      return [
        {
          key: cells[uri]?.trim() ? `lb:${cells[uri].trim()}` : `lb:${title.toLowerCase()}:${cells[year] ?? ""}`,
          source: "letterboxd" as const,
          name: title,
          year: yearOf(cells[year]),
          imdb: null,
          type: "movie" as const,
          status: watchlist && !rated ? ("want" as const) : ("watched" as const),
          rating: rated ? starsFromLetterboxd(stars) : null,
          rounded: rated && !Number.isInteger(stars),
          watchedOn: watchlist ? null : (dateOf(cells[watched]) ?? dateOf(cells[date])),
        },
      ];
    });
  }

  if (col("const") >= 0) {
    const [id, name, year, rating, rated, type] = ["const", "title", "year", "your rating", "date rated", "title type"].map(col);
    return rows.flatMap((cells) => {
      const imdb = cells[id]?.trim();
      if (!imdb || !IMDB_ID.test(imdb)) return [];
      const kind = type >= 0 ? imdbType(cells[type] ?? "") : null;
      if (kind === "skip") return [];
      const score = rating >= 0 && cells[rating]?.trim() ? Number(cells[rating]) : NaN;
      const hasRating = Number.isFinite(score) && score >= 1 && score <= 10;
      return [
        {
          key: `imdb:${imdb}`,
          source: "imdb" as const,
          name: cells[name]?.trim() || imdb,
          year: yearOf(cells[year]),
          imdb,
          type: kind,
          status: hasRating ? ("watched" as const) : ("want" as const),
          rating: hasRating ? starsFromImdb(score) : null,
          rounded: hasRating && score % 2 === 1,
          watchedOn: hasRating ? dateOf(cells[rated]) : null,
        },
      ];
    });
  }
  return null;
}

/**
 * One row per title across all the files: watched beats Up next, the rating is the one given last (by
 * date), and the watched date is the earliest one known.
 */
export function mergeRows(rows: ImportRow[]): ImportRow[] {
  const byKey = new Map<string, ImportRow>();
  for (const row of rows) {
    const seen = byKey.get(row.key);
    if (!seen) {
      byKey.set(row.key, row);
      continue;
    }
    const later = (row.watchedOn ?? "") >= (seen.watchedOn ?? "") ? row : seen;
    const rater = later.rating !== null ? later : later === row ? seen : row;
    const dates = [seen.watchedOn, row.watchedOn].filter((d): d is string => d !== null).sort();
    byKey.set(row.key, {
      ...seen,
      status: seen.status === "watched" || row.status === "watched" ? "watched" : "want",
      rating: rater.rating,
      rounded: rater.rounded,
      watchedOn: dates[0] ?? null,
      type: seen.type ?? row.type,
      year: seen.year ?? row.year,
    });
  }
  return [...byKey.values()];
}

/** What the browser asks the server to look up for one title. */
export type MatchQuery = Pick<ImportRow, "key" | "name" | "year" | "imdb" | "type">;

/** A title found on TMDB for an import row (or null), and whether it's already on the list. */
export type MatchResult = {
  key: string;
  match: (TitleRef & { title: string; year: string | null; poster_path: string | null; onList: boolean }) | null;
};

/** A title to add, as the browser sends it after the preview. */
export type ImportItem = TitleRef & { status: ImportStatus; rating: number | null; watchedOn: string | null };

/** Lower case without accents or punctuation, for comparing a title from an export with TMDB's. */
export function sameTitle(a: string, b: string) {
  const norm = (s: string) =>
    s
      .normalize("NFKD")
      .replace(/\p{M}/gu, "")
      .toLowerCase()
      .replace(/&/g, "and")
      .replace(/[^\p{L}\p{N}]+/gu, "");
  return norm(a) === norm(b);
}

/** The best of TMDB's search results for a title and year: an exact name match first, else the first result. */
export function bestMatch<T extends { title: string; original_title: string; year: number | null }>(
  name: string,
  year: number | null,
  results: T[],
): T | null {
  const exact = results.filter((r) => sameTitle(r.title, name) || sameTitle(r.original_title, name));
  return exact.find((r) => year === null || r.year === year) ?? exact[0] ?? results[0] ?? null;
}

/**
 * The titles to add once the preview is confirmed: matched, not already on the list, one per title (two
 * rows can find the same title: watched wins and the first rating found stays).
 */
export function toImport(rows: ImportRow[], results: Map<string, MatchResult["match"]>): ImportItem[] {
  const byTitle = new Map<string, ImportItem>();
  for (const row of rows) {
    const match = results.get(row.key);
    if (!match || match.onList) continue;
    const key = `${match.media_type}:${match.tmdb_id}`;
    const item: ImportItem = {
      media_type: match.media_type,
      tmdb_id: match.tmdb_id,
      status: row.status,
      rating: row.status === "watched" ? row.rating : null,
      watchedOn: row.status === "watched" ? row.watchedOn : null,
    };
    const seen = byTitle.get(key);
    byTitle.set(
      key,
      seen
        ? { ...seen, status: seen.status === "watched" || item.status === "watched" ? "watched" : "want", rating: seen.rating ?? item.rating, watchedOn: seen.watchedOn ?? item.watchedOn }
        : item,
    );
  }
  return [...byTitle.values()];
}
