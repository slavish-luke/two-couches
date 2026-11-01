"use server";

import { refresh } from "next/cache";
import {
  cleanCategories,
  isDateString,
  isListStatus,
  isProgress,
  localDate,
  MAX_NOTES_LENGTH,
  type ListStatus,
  type Progress,
} from "@/lib/list-rules";
import { getPartner, requireProfile } from "@/lib/session";
import type { Database } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";
import { getTitle } from "@/lib/titles";
import { tmdbLocale } from "@/lib/tmdb";
import { isMediaType, type TitleRef } from "@/lib/watch";

// Everything here runs as the signed-in user, so RLS limits it to their couple's list.

export type ListResult = { error?: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function requireCouple() {
  const profile = await requireProfile();
  if (!profile.couple_id || !profile.country) throw new Error("Finish setting up before using the list");
  return { ...profile, couple_id: profile.couple_id, country: profile.country };
}

function cleanNotes(value: unknown) {
  const notes = typeof value === "string" ? value.trim() : "";
  return notes.length <= MAX_NOTES_LENGTH ? notes : null;
}

export async function addToList(ref: TitleRef, notes: string = ""): Promise<ListResult> {
  const profile = await requireCouple();
  if (!isMediaType(ref?.media_type) || !Number.isSafeInteger(ref.tmdb_id) || ref.tmdb_id <= 0) {
    return { error: "That isn't a film or series." };
  }
  const note = cleanNotes(notes);
  if (note === null) return { error: `Keep the note under ${MAX_NOTES_LENGTH} characters.` };

  // Cache the title in both people's languages, so it shows up named on both screens straight away.
  const partner = await getPartner();
  const locales = new Set([tmdbLocale(profile.language, profile.country)]);
  if (partner?.country) locales.add(tmdbLocale(partner.language, partner.country));
  const key = { media_type: ref.media_type, tmdb_id: ref.tmdb_id };
  try {
    const titles = await Promise.all([...locales].map((locale) => getTitle(key, locale)));
    if (titles.some((t) => !t)) return { error: "TMDB doesn't know that title." };
  } catch (error) {
    console.error("Loading a title to add failed", error);
    return { error: "Couldn't reach TMDB. Try again." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("list_items")
    .insert({ ...key, couple_id: profile.couple_id, added_by: profile.id, notes: note });
  // 23505: already on the list, perhaps added by the other person a moment ago.
  if (error && error.code !== "23505") {
    console.error("Adding to the list failed", error);
    return { error: "Couldn't add it. Try again." };
  }
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
  const profile = await requireCouple();
  if (!UUID.test(id)) return { error: "That list item doesn't exist." };

  const update: Database["public"]["Tables"]["list_items"]["Update"] = {};
  if (changes.status !== undefined) {
    if (!isListStatus(changes.status)) return { error: "Pick a status." };
    update.status = changes.status;
  }
  if (changes.categories !== undefined) {
    const categories = cleanCategories(changes.categories);
    if (!categories) return { error: "Use up to 10 categories of up to 30 characters each." };
    update.categories = categories;
  }
  if (changes.notes !== undefined) {
    const notes = cleanNotes(changes.notes);
    if (notes === null) return { error: `Keep the note under ${MAX_NOTES_LENGTH} characters.` };
    update.notes = notes;
  }
  if (changes.progress !== undefined) {
    if (changes.progress !== null && !isProgress(changes.progress)) return { error: "Enter a season and episode." };
    update.season = changes.progress?.season ?? null;
    update.episode = changes.progress?.episode ?? null;
  }
  if (changes.watched_on !== undefined) {
    if (changes.watched_on !== null && !isDateString(changes.watched_on)) return { error: "Enter a date." };
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
    return { error: "Couldn't save. Try again." };
  }
  refresh();
  return data.length ? {} : { error: "It's no longer on your list." };
}

export async function removeFromList(id: string): Promise<ListResult> {
  await requireCouple();
  if (!UUID.test(id)) return { error: "That list item doesn't exist." };

  const supabase = await createClient();
  const { error } = await supabase.from("list_items").delete().eq("id", id);
  if (error) {
    console.error("Removing a list item failed", error);
    return { error: "Couldn't remove it. Try again." };
  }
  refresh();
  return {};
}

/** Sets or (with null) clears the signed-in person's own rating. */
export async function rateListItem(id: string, rating: number | null): Promise<ListResult> {
  const profile = await requireCouple();
  if (!UUID.test(id)) return { error: "That list item doesn't exist." };
  if (rating !== null && !(Number.isInteger(rating) && rating >= 1 && rating <= 5)) {
    return { error: "Ratings are 1 to 5 stars." };
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
    return { error: "Couldn't save your rating. Try again." };
  }
  refresh();
  return {};
}
