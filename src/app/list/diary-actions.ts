"use server";

import { refresh } from "next/cache";
import { isRating, isSeason, isWatchDate } from "@/lib/diary-rules";
import { getI18n } from "@/lib/i18n/server";
import { localDate } from "@/lib/list-rules";
import { requireCoupleProfile } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import type { ListResult } from "./actions";

// Rewatches and season ratings (Sprint 18). Everything here runs as the signed-in user, so RLS limits it
// to their couple's list.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Logs another watch of a list title on `date` (a local date), with your rating of it if you give one. */
export async function logRewatch(listItemId: string, date: string, rating: number | null): Promise<ListResult> {
  const profile = await requireCoupleProfile();
  const { t } = await getI18n();
  const d = t.diary.errors;
  if (!UUID.test(listItemId)) return { error: t.title.errors.noSuchItem };
  if (!isWatchDate(date, localDate(profile.time_zone))) return { error: d.badDate };
  if (rating !== null && !isRating(rating)) return { error: t.title.errors.ratingRange };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("rewatches")
    .insert({ list_item_id: listItemId, couple_id: profile.couple_id, watched_on: date, added_by: profile.id })
    .select("id")
    .single();
  if (error) {
    console.error("Logging a rewatch failed", error);
    // 23503: the list item is gone (removed on the other screen).
    return { error: error.code === "23503" ? t.title.errors.gone : d.saveFailed };
  }
  if (rating !== null) {
    const { error: ratingError } = await supabase
      .from("rewatch_ratings")
      .insert({ rewatch_id: data.id, couple_id: profile.couple_id, profile_id: profile.id, rating });
    if (ratingError) console.error("Rating a new rewatch failed", ratingError);
  }
  refresh();
  return {};
}

/** Moves a rewatch to another date. */
export async function redateRewatch(id: string, date: string): Promise<ListResult> {
  const profile = await requireCoupleProfile();
  const { t } = await getI18n();
  if (!UUID.test(id)) return { error: t.title.errors.noSuchItem };
  if (!isWatchDate(date, localDate(profile.time_zone))) return { error: t.diary.errors.badDate };

  const supabase = await createClient();
  const { data, error } = await supabase.from("rewatches").update({ watched_on: date }).eq("id", id).select("id");
  if (error) {
    console.error("Changing a rewatch's date failed", error);
    return { error: t.diary.errors.saveFailed };
  }
  refresh();
  return data.length ? {} : { error: t.title.errors.gone };
}

export async function removeRewatch(id: string): Promise<ListResult> {
  await requireCoupleProfile();
  const { t } = await getI18n();
  if (!UUID.test(id)) return { error: t.title.errors.noSuchItem };

  const supabase = await createClient();
  const { error } = await supabase.from("rewatches").delete().eq("id", id);
  if (error) {
    console.error("Removing a rewatch failed", error);
    return { error: t.diary.errors.saveFailed };
  }
  refresh();
  return {};
}

/** Sets or (with null) clears your own rating of one rewatch. */
export async function rateRewatch(id: string, rating: number | null): Promise<ListResult> {
  const profile = await requireCoupleProfile();
  const { t } = await getI18n();
  if (!UUID.test(id)) return { error: t.title.errors.noSuchItem };
  if (rating !== null && !isRating(rating)) return { error: t.title.errors.ratingRange };

  const supabase = await createClient();
  const mine = { rewatch_id: id, profile_id: profile.id };
  let error;
  if (rating === null) {
    ({ error } = await supabase.from("rewatch_ratings").delete().match(mine));
  } else {
    // Update first: users may change only the rating column, which rules out an upsert.
    const updated = await supabase.from("rewatch_ratings").update({ rating }).match(mine).select("rating");
    error = updated.error;
    if (!error && !updated.data?.length) {
      ({ error } = await supabase.from("rewatch_ratings").insert({ ...mine, couple_id: profile.couple_id, rating }));
    }
  }
  if (error) {
    console.error("Rating a rewatch failed", error);
    return { error: t.title.errors.rateFailed };
  }
  refresh();
  return {};
}

/** Sets or (with null) clears your own rating of one season of a series on the list. */
export async function rateSeason(listItemId: string, season: number, rating: number | null): Promise<ListResult> {
  const profile = await requireCoupleProfile();
  const { t } = await getI18n();
  if (!UUID.test(listItemId) || !isSeason(season)) return { error: t.title.errors.noSuchItem };
  if (rating !== null && !isRating(rating)) return { error: t.title.errors.ratingRange };

  const supabase = await createClient();
  const mine = { list_item_id: listItemId, profile_id: profile.id, season };
  let error;
  if (rating === null) {
    ({ error } = await supabase.from("season_ratings").delete().match(mine));
  } else {
    const updated = await supabase.from("season_ratings").update({ rating }).match(mine).select("rating");
    error = updated.error;
    if (!error && !updated.data?.length) {
      ({ error } = await supabase.from("season_ratings").insert({ ...mine, couple_id: profile.couple_id, rating }));
    }
  }
  if (error) {
    console.error("Rating a season failed", error);
    return { error: t.title.errors.rateFailed };
  }
  refresh();
  return {};
}
