import "server-only";
import { cache } from "react";
import type { ListStatus } from "./list-rules";
import { createClient } from "./supabase/server";
import type { Guess, NightAt, RatedEntry } from "./taste-rules";
import type { MediaType } from "./watch";

/** Every guess either of you has made, for scoring on Stats. */
export async function getGuesses(coupleId: string): Promise<Guess[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("rating_guesses")
    .select("list_item_id, profile_id, guess, actual")
    .eq("couple_id", coupleId);
  if (error) throw error;
  return data;
}

/** The guesses made on one list item (yours and your partner's), for the title page. */
export async function getItemGuesses(itemId: string): Promise<Guess[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("rating_guesses")
    .select("list_item_id, profile_id, guess, actual")
    .eq("list_item_id", itemId);
  if (error) throw error;
  return data;
}

/**
 * The couple's watch nights for streaks and milestones: each one's start, in the time zone of whoever
 * planned it (`zones` by profile ID), or `fallbackZone` when that person is gone.
 */
export async function getNightsAt(coupleId: string, zones: Record<string, string>, fallbackZone: string): Promise<NightAt[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("watch_nights").select("starts_at, created_by").eq("couple_id", coupleId);
  if (error) throw error;
  return data.map((n) => ({ starts_at: n.starts_at, zone: (n.created_by && zones[n.created_by]) || fallbackZone }));
}

/**
 * The list as the taste rules need it (status, date watched, genres, both ratings), without names or
 * posters: lighter than getList() for Home's chip and the title page's predictions. Memoised per request.
 */
export const getRatedList = cache(async (coupleId: string): Promise<RatedEntry[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("list_items")
    .select("id, media_type, status, watched_on, list_ratings(profile_id, rating), titles(genre_ids)")
    .eq("couple_id", coupleId);
  if (error) throw error;
  return data.map((row) => ({
    id: row.id,
    media_type: row.media_type as MediaType,
    status: row.status as ListStatus,
    watched_on: row.watched_on,
    genre_ids: row.titles.genre_ids,
    ratings: Object.fromEntries(row.list_ratings.map((r) => [r.profile_id, r.rating])),
  }));
});
