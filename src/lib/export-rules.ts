/**
 * "Your data" (Sprint 18): the couple's list, watches, season ratings, watch nights and reviews as one JSON
 * document or a CSV per kind. Pure functions, safe in server and client code.
 */
import type { Rewatch, SeasonRatings } from "./diary-rules";
import type { ListStatus } from "./list-rules";
import type { MediaType } from "./watch";

export const CSV_KINDS = ["list", "watches", "seasons", "nights", "reviews"] as const;
export type CsvKind = (typeof CSV_KINDS)[number];

export function isCsvKind(value: unknown): value is CsvKind {
  return typeof value === "string" && (CSV_KINDS as readonly string[]).includes(value);
}

export type ExportPerson = { id: string; name: string; me: boolean };

export type ExportItem = {
  id: string;
  media_type: MediaType;
  tmdb_id: number;
  title: string;
  year: string | null;
  status: ListStatus;
  categories: string[];
  notes: string;
  season: number | null;
  episode: number | null;
  watched_on: string | null;
  added_by: string | null;
  created_at: string;
  ratings: Record<string, number>;
};

export type ExportNight = {
  starts_at: string;
  media_type: string | null;
  tmdb_id: number | null;
  title: string | null;
  method: string | null;
  link: string | null;
  syncplay_server: string | null;
  syncplay_room: string | null;
  notes: string;
  created_by: string | null;
};

export type ExportReview = { list_item_id: string; profile_id: string; body: string; updated_at: string };

export type ExportData = {
  people: ExportPerson[];
  items: ExportItem[];
  rewatches: Rewatch[];
  /** By list item ID. */
  seasons: Record<string, SeasonRatings>;
  nights: ExportNight[];
  reviews: ExportReview[];
};

type Cell = string | number | null | undefined;

/** One CSV field: quoted when it holds a comma, quote or line break; a leading = + - @ is defused for spreadsheets. */
export function csvField(value: Cell) {
  if (value === null || value === undefined) return "";
  let text = String(value);
  if (typeof value === "string" && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Rows as CSV with CRLF line ends and a byte-order mark, so spreadsheets read it as UTF-8 (Turkish letters). */
export function toCsv(rows: Cell[][]) {
  return `﻿${rows.map((row) => row.map(csvField).join(",")).join("\r\n")}\r\n`;
}

/** Column headings name each person ("Rating (Sam)"); the CSVs are for reading, not for importing back. */
function personColumns(people: ExportPerson[], label: (name: string) => string) {
  return people.map((p) => label(p.name));
}

/** The CSV for one kind. `headings` are the column names in the viewer's language. */
export function exportCsv(kind: CsvKind, data: ExportData, headings: CsvHeadings) {
  const h = headings;
  const name = (id: string | null) => data.people.find((p) => p.id === id)?.name ?? "";
  const byId = new Map(data.items.map((i) => [i.id, i]));
  const rewatchCount = (id: string) => data.rewatches.filter((r) => r.list_item_id === id).length;

  switch (kind) {
    case "list":
      return toCsv([
        [h.title, h.type, h.year, h.tmdbId, h.status, h.addedBy, h.addedOn, h.watchedOn, h.timesWatched, h.progress, h.categories, h.note, ...personColumns(data.people, h.rating)],
        ...data.items.map((i) => [
          i.title,
          h.types[i.media_type],
          i.year,
          i.tmdb_id,
          h.statuses[i.status],
          name(i.added_by),
          i.created_at.slice(0, 10),
          i.watched_on,
          i.status === "watched" || i.watched_on ? 1 + rewatchCount(i.id) : rewatchCount(i.id) || null,
          i.season && i.episode ? `S${i.season} E${i.episode}` : null,
          i.categories.join("; "),
          i.notes,
          ...data.people.map((p) => i.ratings[p.id] ?? null),
        ]),
      ]);
    case "watches": {
      const rows = data.items.flatMap((i) => [
        ...(i.watched_on ? [{ item: i, date: i.watched_on, again: false, ratings: i.ratings }] : []),
        ...data.rewatches.filter((r) => r.list_item_id === i.id).map((r) => ({ item: i, date: r.watched_on, again: true, ratings: r.ratings })),
      ]);
      rows.sort((a, b) => a.date.localeCompare(b.date));
      return toCsv([
        [h.date, h.title, h.type, h.tmdbId, h.rewatch, ...personColumns(data.people, h.rating)],
        ...rows.map((w) => [w.date, w.item.title, h.types[w.item.media_type], w.item.tmdb_id, w.again ? h.yes : h.no, ...data.people.map((p) => w.ratings[p.id] ?? null)]),
      ]);
    }
    case "seasons":
      return toCsv([
        [h.title, h.tmdbId, h.season, ...personColumns(data.people, h.rating)],
        ...Object.entries(data.seasons).flatMap(([itemId, seasons]) => {
          const item = byId.get(itemId);
          return Object.entries(seasons).map(([season, ratings]) => [
            item?.title ?? "",
            item?.tmdb_id ?? null,
            Number(season),
            ...data.people.map((p) => ratings[p.id] ?? null),
          ]);
        }),
      ]);
    case "nights":
      return toCsv([
        [h.startsUtc, h.title, h.type, h.tmdbId, h.method, h.link, h.syncplayServer, h.syncplayRoom, h.note, h.plannedBy],
        ...data.nights.map((n) => [n.starts_at, n.title, n.media_type === "movie" || n.media_type === "tv" ? h.types[n.media_type] : null, n.tmdb_id, n.method, n.link, n.syncplay_server, n.syncplay_room, n.notes, name(n.created_by)]),
      ]);
    case "reviews":
      return toCsv([
        [h.title, h.type, h.tmdbId, h.by, h.review, h.updated],
        ...data.reviews.map((r) => {
          const item = byId.get(r.list_item_id);
          return [item?.title ?? "", item ? h.types[item.media_type] : "", item?.tmdb_id ?? null, name(r.profile_id), r.body, r.updated_at.slice(0, 10)];
        }),
      ]);
  }
}

/** The whole lot as one JSON document, with names instead of IDs where a person is meant. */
export function exportJson(data: ExportData, exportedAt: Date) {
  const name = (id: string | null) => data.people.find((p) => p.id === id)?.name ?? null;
  const byName = (ratings: Record<string, number>) =>
    Object.fromEntries(data.people.filter((p) => ratings[p.id]).map((p) => [p.name, ratings[p.id]]));
  return {
    app: "Two Couches",
    version: 1,
    exported_at: exportedAt.toISOString(),
    people: data.people.map((p) => ({ name: p.name, me: p.me })),
    list: data.items.map((i) => ({
      media_type: i.media_type,
      tmdb_id: i.tmdb_id,
      title: i.title,
      year: i.year,
      status: i.status,
      categories: i.categories,
      note: i.notes,
      progress: i.season && i.episode ? { season: i.season, episode: i.episode } : null,
      watched_on: i.watched_on,
      added_by: name(i.added_by),
      added_at: i.created_at,
      ratings: byName(i.ratings),
      rewatches: data.rewatches
        .filter((r) => r.list_item_id === i.id)
        .map((r) => ({ watched_on: r.watched_on, ratings: byName(r.ratings) })),
      season_ratings: Object.entries(data.seasons[i.id] ?? {}).map(([season, ratings]) => ({ season: Number(season), ratings: byName(ratings) })),
      reviews: data.reviews.filter((r) => r.list_item_id === i.id).map((r) => ({ by: name(r.profile_id), body: r.body, updated_at: r.updated_at })),
    })),
    watch_nights: data.nights.map((n) => ({
      starts_at: n.starts_at,
      media_type: n.media_type,
      tmdb_id: n.tmdb_id,
      title: n.title,
      method: n.method,
      link: n.link,
      syncplay_server: n.syncplay_server,
      syncplay_room: n.syncplay_room,
      note: n.notes,
      planned_by: name(n.created_by),
    })),
  };
}

/** Column headings for the CSVs, from the i18n namespace. */
export type CsvHeadings = {
  types: Record<MediaType, string>;
  statuses: Record<ListStatus, string>;
  title: string;
  type: string;
  year: string;
  tmdbId: string;
  status: string;
  addedBy: string;
  addedOn: string;
  watchedOn: string;
  timesWatched: string;
  progress: string;
  categories: string;
  note: string;
  rating: (name: string) => string;
  date: string;
  rewatch: string;
  yes: string;
  no: string;
  season: string;
  startsUtc: string;
  method: string;
  link: string;
  syncplayServer: string;
  syncplayRoom: string;
  plannedBy: string;
  by: string;
  review: string;
  updated: string;
};

/** "two-couches-list-2026-11-12.csv" */
export function exportFileName(kind: CsvKind | "everything", today: string, extension: "csv" | "json") {
  return `two-couches-${kind}-${today}.${extension}`;
}
