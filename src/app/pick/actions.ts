"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { addToList } from "@/app/list/actions";
import { addDays } from "@/lib/night-rules";
import { getListItem } from "@/lib/list";
import { isDateString, localDate } from "@/lib/list-rules";
import { daySeed, isMood, matchesOf, type Mood } from "@/lib/pick-rules";
import { requireCoupleProfile } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { isMediaType, type TitleRef } from "@/lib/watch";
import { getSwipes } from "./data";

// Everything here runs as the signed-in user, so RLS limits it to their own moods and swipes.

/** What the swipe deck needs to know after a change: how far your partner is, and what you both said yes to. */
export type SwipeStatus = { ok: boolean; partnerCount: number; matches: string[] };

function isRef(ref: unknown): ref is TitleRef {
  const r = ref as TitleRef | null;
  return !!r && isMediaType(r.media_type) && Number.isSafeInteger(r.tmdb_id) && r.tmdb_id > 0;
}

/** A deck's day: today's UTC date, or the day either side of it (a deck left open over midnight UTC). */
function isDeckDay(day: unknown): day is string {
  if (!isDateString(day)) return false;
  const today = daySeed(new Date());
  return day === today || day === addDays(today, -1) || day === addDays(today, 1);
}

/** Today's mood, or null to clear it. It counts until midnight on your own clock. */
export async function setMood(mood: Mood | null): Promise<{ ok: boolean }> {
  const profile = await requireCoupleProfile();
  if (mood !== null && !isMood(mood)) return { ok: false };
  const supabase = await createClient();
  let error;
  if (mood === null) {
    ({ error } = await supabase.from("moods").delete().eq("profile_id", profile.id));
  } else {
    const fields = { mood, on_day: localDate(profile.time_zone) };
    // Update first, then insert: only the mood and its day may change, so no upsert.
    const updated = await supabase.from("moods").update(fields).eq("profile_id", profile.id).select("profile_id");
    error = updated.error;
    if (!error && !updated.data?.length) {
      ({ error } = await supabase.from("moods").insert({ ...fields, profile_id: profile.id, couple_id: profile.couple_id }));
    }
  }
  if (error) {
    console.error("Saving a mood failed", error);
    return { ok: false };
  }
  // The pick and the deck lean on both moods, so they're dealt again.
  refresh();
  return { ok: true };
}

async function statusFor(coupleId: string, day: string, myId: string, ok = true): Promise<SwipeStatus> {
  const { mine, theirs } = await getSwipes(coupleId, day, myId);
  return { ok, partnerCount: Object.keys(theirs).length, matches: matchesOf(mine, theirs, []) };
}

/** Where your partner is in the day's deck, and your matches. */
export async function swipeStatus(day: string): Promise<SwipeStatus> {
  const profile = await requireCoupleProfile();
  if (!isDeckDay(day)) return { ok: false, partnerCount: 0, matches: [] };
  return statusFor(profile.couple_id, day, profile.id);
}

/** Yes (`liked`) or no to a title in the day's deck. Swiping it again changes your answer. */
export async function recordSwipe(day: string, ref: TitleRef, liked: boolean): Promise<SwipeStatus> {
  const profile = await requireCoupleProfile();
  if (!isDeckDay(day) || !isRef(ref) || typeof liked !== "boolean") return { ok: false, partnerCount: 0, matches: [] };
  const supabase = await createClient();
  const key = { media_type: ref.media_type, tmdb_id: ref.tmdb_id };
  const updated = await supabase
    .from("swipes")
    .update({ liked })
    .match({ profile_id: profile.id, day, ...key })
    .select("tmdb_id");
  let error = updated.error;
  if (!error && !updated.data?.length) {
    ({ error } = await supabase.from("swipes").insert({ ...key, day, liked, profile_id: profile.id, couple_id: profile.couple_id }));
  }
  if (error) console.error("Saving a swipe failed", error);
  return statusFor(profile.couple_id, day, profile.id, !error);
}

/** Takes back your swipe on a title (Undo). */
export async function undoSwipe(day: string, ref: TitleRef): Promise<SwipeStatus> {
  const profile = await requireCoupleProfile();
  if (!isDeckDay(day) || !isRef(ref)) return { ok: false, partnerCount: 0, matches: [] };
  const supabase = await createClient();
  const { error } = await supabase
    .from("swipes")
    .delete()
    .match({ profile_id: profile.id, day, media_type: ref.media_type, tmdb_id: ref.tmdb_id });
  if (error) console.error("Undoing a swipe failed", error);
  return statusFor(profile.couple_id, day, profile.id, !error);
}

/** "Start again": clears your swipes for the day (your partner's stay). */
export async function clearSwipes(day: string): Promise<SwipeStatus> {
  const profile = await requireCoupleProfile();
  if (!isDeckDay(day)) return { ok: false, partnerCount: 0, matches: [] };
  const supabase = await createClient();
  const { error } = await supabase.from("swipes").delete().match({ profile_id: profile.id, day });
  if (error) console.error("Clearing swipes failed", error);
  return statusFor(profile.couple_id, day, profile.id, !error);
}

/**
 * "Plan it" on a match: a suggestion that isn't on your list yet is added first (as "+ Add" does), then
 * the watch-night form opens with it picked.
 */
export async function planMatch(ref: TitleRef): Promise<{ error?: string }> {
  const profile = await requireCoupleProfile();
  if (!isRef(ref)) return { error: "not a title" };
  if (!(await getListItem(profile.couple_id, ref))) {
    const added = await addToList(ref);
    if (added.error) return added;
  }
  redirect(`/watch-nights/new?type=${ref.media_type}&id=${ref.tmdb_id}`);
}
