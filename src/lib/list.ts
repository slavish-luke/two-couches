import "server-only";
import type { ListStatus } from "./list-rules";
import { createClient } from "./supabase/server";
import { titleKey, type MediaType, type TitleRef } from "./watch";

export type ListItem = TitleRef & {
  id: string;
  status: ListStatus;
  categories: string[];
  notes: string;
  season: number | null;
  episode: number | null;
  watched_on: string | null;
  added_by: string | null;
  created_at: string;
  updated_at: string;
  /** Rating (1-5) by profile ID. */
  ratings: Record<string, number>;
};

export type ListEntry = ListItem & {
  title: string;
  release_date: string | null;
  poster_path: string | null;
};

function toItem(row: {
  id: string;
  media_type: string;
  tmdb_id: number;
  status: string;
  categories: string[];
  notes: string;
  season: number | null;
  episode: number | null;
  watched_on: string | null;
  added_by: string | null;
  created_at: string;
  updated_at: string;
  list_ratings: { profile_id: string; rating: number }[];
}): ListItem {
  return {
    id: row.id,
    media_type: row.media_type as MediaType,
    tmdb_id: row.tmdb_id,
    status: row.status as ListStatus,
    categories: row.categories,
    notes: row.notes,
    season: row.season,
    episode: row.episode,
    watched_on: row.watched_on,
    added_by: row.added_by,
    created_at: row.created_at,
    updated_at: row.updated_at,
    ratings: Object.fromEntries(row.list_ratings.map((r) => [r.profile_id, r.rating])),
  };
}

/**
 * Every title on the couple's list, newest first. Names come from the cache in the first of `locales`
 * that has one (each person's own language is cached when a title is added), else the original title.
 */
export async function getList(coupleId: string, locales: string[]): Promise<ListEntry[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("list_items")
    .select(
      "*, list_ratings(profile_id, rating), titles(original_title, release_date, poster_path, title_texts(locale, title))",
    )
    .eq("couple_id", coupleId)
    .in("titles.title_texts.locale", locales)
    .order("created_at", { ascending: false });
  if (error) throw error;

  return data.map((row) => {
    const texts = row.titles.title_texts;
    const text = locales.map((l) => texts.find((t) => t.locale === l)).find(Boolean);
    return {
      ...toItem(row),
      title: text?.title ?? row.titles.original_title,
      release_date: row.titles.release_date,
      poster_path: row.titles.poster_path,
    };
  });
}

/** This title's entry on the couple's list, or null if it isn't on it. */
export async function getListItem(coupleId: string, ref: TitleRef): Promise<ListItem | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("list_items")
    .select("*, list_ratings(profile_id, rating)")
    .eq("couple_id", coupleId)
    .eq("media_type", ref.media_type)
    .eq("tmdb_id", ref.tmdb_id)
    .maybeSingle();
  if (error) throw error;
  return data && toItem(data);
}

/** Every category the couple uses, A to Z. */
export async function getCategories(coupleId: string): Promise<string[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("list_items").select("categories").eq("couple_id", coupleId);
  if (error) throw error;
  return [...new Set(data.flatMap((row) => row.categories))].sort((a, b) => a.localeCompare(b));
}

/** titleKey() of every title on the couple's list. */
export async function getListKeys(coupleId: string): Promise<Set<string>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("list_items")
    .select("media_type, tmdb_id")
    .eq("couple_id", coupleId);
  if (error) throw error;
  return new Set(data.map((row) => titleKey(row as TitleRef)));
}
