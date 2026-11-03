"use server";

import { refresh } from "next/cache";
import { getI18n } from "@/lib/i18n/server";
import { requireProfile } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { newFeedToken } from "./token";

// Runs as the signed-in user: RLS limits each person to their own calendar_feeds row.

export type FeedResult = { token?: string; error?: string };

/**
 * Makes a new private calendar link for the signed-in person, revoking any old one. Returns the token:
 * it's shown this once and only its hash is kept.
 */
export async function makeCalendarFeed(): Promise<FeedResult> {
  const [profile, { t }] = await Promise.all([requireProfile(), getI18n()]);
  const supabase = await createClient();
  const { token, hash } = newFeedToken();

  const { error: deleteError } = await supabase.from("calendar_feeds").delete().eq("profile_id", profile.id);
  if (deleteError) return { error: t.nights.calendar.errors.makeFailed };
  const { error } = await supabase.from("calendar_feeds").insert({ profile_id: profile.id, token_hash: hash });
  if (error) {
    console.error("Making a calendar feed failed", error);
    return { error: t.nights.calendar.errors.makeFailed };
  }
  refresh();
  return { token };
}

/** Turns the signed-in person's calendar link off: calendars subscribed to it stop updating. */
export async function stopCalendarFeed(): Promise<FeedResult> {
  const [profile, { t }] = await Promise.all([requireProfile(), getI18n()]);
  const supabase = await createClient();
  const { error } = await supabase.from("calendar_feeds").delete().eq("profile_id", profile.id);
  if (error) return { error: t.nights.calendar.errors.stopFailed };
  refresh();
  return {};
}
