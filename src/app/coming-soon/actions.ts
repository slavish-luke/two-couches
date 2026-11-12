"use server";

import { refresh } from "next/cache";
import { recordBaseline } from "@/lib/alerts";
import { getI18n } from "@/lib/i18n/server";
import { cacheForCouple, coupleCountries } from "@/lib/list";
import { getPartner, requireCoupleProfile, requireProfile } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { isMediaType, type TitleRef } from "@/lib/watch";

// Everything here runs as the signed-in user, so RLS limits it to their couple and their own profile.

/** Sets (or, with `on` false, clears) the couple's "tell us when it's streaming" reminder for a title. */
export async function setReminder(ref: TitleRef, on: boolean): Promise<{ error?: string }> {
  const profile = await requireCoupleProfile();
  const { t } = await getI18n();
  if (!isMediaType(ref?.media_type) || !Number.isSafeInteger(ref.tmdb_id) || ref.tmdb_id <= 0) {
    return { error: t.title.errors.notATitle };
  }
  const key = { media_type: ref.media_type, tmdb_id: ref.tmdb_id };
  const supabase = await createClient();

  if (!on) {
    const { error } = await supabase.from("reminders").delete().match({ ...key, couple_id: profile.couple_id });
    if (error) {
      console.error("Clearing a reminder failed", error);
      return { error: t.upcoming.reminders.failed };
    }
    refresh();
    return {};
  }

  const cached = await cacheForCouple(key, profile);
  if (cached === "unknown") return { error: t.title.errors.unknownTitle };
  if (cached === "failed") return { error: t.title.errors.tmdbDown };

  const { error } = await supabase
    .from("reminders")
    .insert({ ...key, couple_id: profile.couple_id, created_by: profile.id });
  // 23505: already set, perhaps by the other person a moment ago.
  if (error && error.code !== "23505") {
    console.error("Setting a reminder failed", error);
    return { error: t.upcoming.reminders.failed };
  }
  await recordBaseline(key, await coupleCountries(profile));
  refresh();
  return {};
}

/** Marks every alert so far as seen by the signed-in person, which clears the dot in the nav. */
export async function markAlertsSeen() {
  const profile = await requireProfile();
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ alerts_seen_at: new Date().toISOString() })
    .eq("id", profile.id);
  if (error) console.error("Marking alerts seen failed", error);
  refresh();
}

/**
 * Marks (or, with `on` false, unmarks) a title as one the signed-in person can't wait for. Once you both
 * have, the couple gets a "Remind us" reminder for it, set here as the second person. `both` says so.
 */
export async function setCantWait(ref: TitleRef, on: boolean): Promise<{ error?: string; both?: boolean }> {
  const profile = await requireCoupleProfile();
  const { t } = await getI18n();
  if (!isMediaType(ref?.media_type) || !Number.isSafeInteger(ref.tmdb_id) || ref.tmdb_id <= 0) {
    return { error: t.title.errors.notATitle };
  }
  const key = { media_type: ref.media_type, tmdb_id: ref.tmdb_id };
  const supabase = await createClient();

  if (!on) {
    const { error } = await supabase.from("cant_wait").delete().match({ ...key, profile_id: profile.id });
    if (error) {
      console.error("Clearing a can't wait failed", error);
      return { error: t.discovery.cantWait.failed };
    }
    refresh();
    return {};
  }

  const { error } = await supabase
    .from("cant_wait")
    .insert({ ...key, couple_id: profile.couple_id, profile_id: profile.id });
  // 23505: already marked, perhaps on another screen.
  if (error && error.code !== "23505") {
    console.error("Saving a can't wait failed", error);
    return { error: t.discovery.cantWait.failed };
  }

  const [{ data: marks, error: marksError }, partner] = await Promise.all([
    supabase.from("cant_wait").select("profile_id").match({ ...key, couple_id: profile.couple_id }),
    getPartner(),
  ]);
  if (marksError) console.error("Reading can't waits failed", marksError);
  const people = [profile.id, ...(partner ? [partner.id] : [])];
  const both = Boolean(partner) && people.every((id) => marks?.some((m) => m.profile_id === id));
  if (both) {
    const reminder = await setReminder(key, true);
    if (reminder.error) console.error("Setting the reminder for a shared can't wait failed", reminder.error);
  }
  refresh();
  return { both };
}
