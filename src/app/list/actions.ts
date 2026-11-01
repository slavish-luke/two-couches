"use server";

import { refresh } from "next/cache";
import { recordBaseline } from "@/lib/alerts";
import { getI18n } from "@/lib/i18n/server";
import {
  cleanCategories,
  isDateString,
  isListStatus,
  isProgress,
  localDate,
  MAX_CATEGORIES,
  MAX_CATEGORY_LENGTH,
  MAX_NOTES_LENGTH,
  type ListStatus,
  type Progress,
} from "@/lib/list-rules";
import { cacheForCouple, coupleCountries } from "@/lib/list";
import { requireCoupleProfile } from "@/lib/session";
import type { Database } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";
import { isMediaType, type TitleRef } from "@/lib/watch";

// Everything here runs as the signed-in user, so RLS limits it to their couple's list.

export type ListResult = { error?: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function cleanNotes(value: unknown) {
  const notes = typeof value === "string" ? value.trim() : "";
  return notes.length <= MAX_NOTES_LENGTH ? notes : null;
}

export async function addToList(ref: TitleRef, notes: string = ""): Promise<ListResult> {
  const profile = await requireCoupleProfile();
  const { t } = await getI18n();
  if (!isMediaType(ref?.media_type) || !Number.isSafeInteger(ref.tmdb_id) || ref.tmdb_id <= 0) {
    return { error: t.title.errors.notATitle };
  }
  const note = cleanNotes(notes);
  if (note === null) return { error: t.title.errors.noteTooLong(MAX_NOTES_LENGTH) };

  const key = { media_type: ref.media_type, tmdb_id: ref.tmdb_id };
  const cached = await cacheForCouple(key, profile);
  if (cached === "unknown") return { error: t.title.errors.unknownTitle };
  if (cached === "failed") return { error: t.title.errors.tmdbDown };

  const supabase = await createClient();
  const { error } = await supabase
    .from("list_items")
    .insert({ ...key, couple_id: profile.couple_id, added_by: profile.id, notes: note });
  // 23505: already on the list, perhaps added by the other person a moment ago.
  if (error && error.code !== "23505") {
    console.error("Adding to the list failed", error);
    return { error: t.title.errors.addFailed };
  }
  await recordBaseline(key, await coupleCountries(profile));
  refresh();
  return {};
}

export type ListChanges = {
  status?: ListStatus;
  categories?: string[];
  notes?: string;
  /** null clears it. */
  progress?: Progress | null;
  watched_on?: string | null;
};

export async function updateListItem(id: string, changes: ListChanges): Promise<ListResult> {
  const profile = await requireCoupleProfile();
  const { t } = await getI18n();
  if (!UUID.test(id)) return { error: t.title.errors.noSuchItem };

  const update: Database["public"]["Tables"]["list_items"]["Update"] = {};
  if (changes.status !== undefined) {
    if (!isListStatus(changes.status)) return { error: t.title.errors.pickStatus };
    update.status = changes.status;
  }
  if (changes.categories !== undefined) {
    const categories = cleanCategories(changes.categories);
    if (!categories) return { error: t.title.errors.badCategories(MAX_CATEGORIES, MAX_CATEGORY_LENGTH) };
    update.categories = categories;
  }
  if (changes.notes !== undefined) {
    const notes = cleanNotes(changes.notes);
    if (notes === null) return { error: t.title.errors.noteTooLong(MAX_NOTES_LENGTH) };
    update.notes = notes;
  }
  if (changes.progress !== undefined) {
    if (changes.progress !== null && !isProgress(changes.progress)) return { error: t.title.errors.enterProgress };
    update.season = changes.progress?.season ?? null;
    update.episode = changes.progress?.episode ?? null;
  }
  if (changes.watched_on !== undefined) {
    if (changes.watched_on !== null && !isDateString(changes.watched_on)) return { error: t.title.errors.enterDate };
    update.watched_on = changes.watched_on;
  }

  const supabase = await createClient();
  if (update.status === "watched" && update.watched_on === undefined) {
    // The first time it's marked watched, date it today in this person's time zone.
    const { data } = await supabase.from("list_items").select("watched_on").eq("id", id).maybeSingle();
    if (data && !data.watched_on) update.watched_on = localDate(profile.time_zone);
  }

  const { data, error } = await supabase.from("list_items").update(update).eq("id", id).select("id");
  if (error) {
    console.error("Updating a list item failed", error);
    return { error: t.title.errors.saveFailed };
  }
  refresh();
  return data.length ? {} : { error: t.title.errors.gone };
}

export async function removeFromList(id: string): Promise<ListResult> {
  await requireCoupleProfile();
  const { t } = await getI18n();
  if (!UUID.test(id)) return { error: t.title.errors.noSuchItem };

  const supabase = await createClient();
  const { error } = await supabase.from("list_items").delete().eq("id", id);
  if (error) {
    console.error("Removing a list item failed", error);
    return { error: t.title.errors.removeFailed };
  }
  refresh();
  return {};
}

/** Sets or (with null) clears the signed-in person's own rating. */
export async function rateListItem(id: string, rating: number | null): Promise<ListResult> {
  const profile = await requireCoupleProfile();
  const { t } = await getI18n();
  if (!UUID.test(id)) return { error: t.title.errors.noSuchItem };
  if (rating !== null && !(Number.isInteger(rating) && rating >= 1 && rating <= 5)) {
    return { error: t.title.errors.ratingRange };
  }

  const supabase = await createClient();
  const mine = { list_item_id: id, profile_id: profile.id };
  let error;
  if (rating === null) {
    ({ error } = await supabase.from("list_ratings").delete().match(mine));
  } else {
    // Update first: users may change only the rating column, which rules out an upsert.
    const updated = await supabase.from("list_ratings").update({ rating }).match(mine).select("rating");
    error = updated.error;
    if (!error && !updated.data?.length) {
      ({ error } = await supabase.from("list_ratings").insert({ ...mine, couple_id: profile.couple_id, rating }));
    }
  }
  if (error) {
    console.error("Rating a list item failed", error);
    return { error: t.title.errors.rateFailed };
  }
  refresh();
  return {};
}
