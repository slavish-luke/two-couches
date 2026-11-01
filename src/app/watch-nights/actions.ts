"use server";

import { refresh } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { getI18n } from "@/lib/i18n/server";
import { isDateString } from "@/lib/list-rules";
import { cacheForCouple } from "@/lib/list";
import {
  cleanLink,
  isNightMethod,
  isSyncplayServer,
  isTimeString,
  MAX_DAYS_AHEAD,
  MAX_NIGHT_NOTES_LENGTH,
  MAX_SYNCPLAY_LENGTH,
  zonedToUtc,
  type NightMethod,
} from "@/lib/night-rules";
import { notifyPartner, type NightChange } from "@/lib/nights";
import { requireCoupleProfile } from "@/lib/session";
import type { Database } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";
import { isMediaType, type TitleRef } from "@/lib/watch";

// Everything here runs as the signed-in user, so RLS limits it to their couple's watch nights.

export type NightResult = { error?: string };

export type NightInput = {
  title: TitleRef | null;
  /** The start, as a date and time on the planner's own clock (their profile's time zone). */
  date: string;
  time: string;
  method: NightMethod | null;
  link: string;
  syncplay_server: string;
  syncplay_room: string;
  notes: string;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Some leeway for a form opened a little before the start time. */
const PAST_GRACE_MS = 15 * 60 * 1000;

type Profile = Awaited<ReturnType<typeof requireCoupleProfile>>;

/** Tells the partner once the response is sent, so a slow push service doesn't hold up the page. */
async function notifyLater(change: NightChange, night: Parameters<typeof notifyPartner>[1], profile: Profile) {
  const contact = (await headers()).get("origin");
  if (!contact) return;
  after(() => notifyPartner(change, night, profile, contact));
}

/** Plans a new watch night (`id` null) or changes one, then goes back to the calendar. */
export async function saveWatchNight(id: string | null, input: NightInput): Promise<NightResult> {
  const profile = await requireCoupleProfile();
  const { t } = await getI18n();
  const errors = t.nights.errors;
  if (id !== null && !UUID.test(id)) return { error: errors.gone };

  if (!isDateString(input?.date) || !isTimeString(input.time)) return { error: errors.pickTime };
  const startsAt = zonedToUtc(input.date, input.time, profile.time_zone);
  if (startsAt.getTime() > Date.now() + MAX_DAYS_AHEAD * 24 * 60 * 60 * 1000) return { error: errors.tooFar };

  let title: TitleRef | null = null;
  if (input.title) {
    if (!isMediaType(input.title.media_type) || !Number.isSafeInteger(input.title.tmdb_id) || input.title.tmdb_id <= 0) {
      return { error: t.title.errors.notATitle };
    }
    title = { media_type: input.title.media_type, tmdb_id: input.title.tmdb_id };
  }

  const method = isNightMethod(input.method) ? input.method : null;
  const link = method === "teleparty" || method === "other" ? cleanLink(input.link) : "";
  if (link === null) return { error: errors.badLink };
  const server = method === "syncplay" && typeof input.syncplay_server === "string" ? input.syncplay_server.trim() : "";
  if (server && !isSyncplayServer(server)) return { error: errors.badServer };
  const room = method === "syncplay" && typeof input.syncplay_room === "string" ? input.syncplay_room.trim() : "";
  if (room.length > MAX_SYNCPLAY_LENGTH) return { error: errors.roomTooLong(MAX_SYNCPLAY_LENGTH) };
  const notes = typeof input.notes === "string" ? input.notes.trim() : "";
  if (notes.length > MAX_NIGHT_NOTES_LENGTH) return { error: errors.noteTooLong(MAX_NIGHT_NOTES_LENGTH) };

  const supabase = await createClient();
  const before = id
    ? (await supabase.from("watch_nights").select("starts_at, media_type, tmdb_id").eq("id", id).maybeSingle()).data
    : null;
  if (id && !before) return { error: errors.gone };
  const moved = !before || Date.parse(before.starts_at) !== startsAt.getTime();
  // Editing the note of a night that's under way is fine; moving one into the past isn't.
  if (moved && startsAt.getTime() < Date.now() - PAST_GRACE_MS) return { error: errors.inPast };

  if (title) {
    const cached = await cacheForCouple(title, profile);
    if (cached === "unknown") return { error: t.title.errors.unknownTitle };
    if (cached === "failed") return { error: t.title.errors.tmdbDown };
  }

  const fields: Database["public"]["Tables"]["watch_nights"]["Update"] = {
    media_type: title?.media_type ?? null,
    tmdb_id: title?.tmdb_id ?? null,
    starts_at: startsAt.toISOString(),
    method,
    link: link || null,
    syncplay_server: server || null,
    syncplay_room: room || null,
    notes,
  };
  const saved = id
    ? await supabase.from("watch_nights").update(fields).eq("id", id).select("id").maybeSingle()
    : await supabase
        .from("watch_nights")
        .insert({ ...fields, starts_at: fields.starts_at!, couple_id: profile.couple_id, created_by: profile.id })
        .select("id")
        .single();
  if (saved.error || !saved.data) {
    if (saved.error) console.error("Saving a watch night failed", saved.error);
    return { error: saved.error ? errors.saveFailed : errors.gone };
  }

  const retitled = before && (before.media_type !== fields.media_type || before.tmdb_id !== fields.tmdb_id);
  if (!before || moved || retitled) {
    await notifyLater(before ? "changed" : "planned", { id: saved.data.id, starts_at: fields.starts_at!, title }, profile);
  }
  refresh();
  redirect("/watch-nights");
}

/** Cancels a watch night for both of you and tells your partner. */
export async function cancelWatchNight(id: string): Promise<NightResult> {
  const profile = await requireCoupleProfile();
  const { t } = await getI18n();
  if (!UUID.test(id)) return { error: t.nights.errors.gone };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("watch_nights")
    .delete()
    .eq("id", id)
    .select("id, starts_at, media_type, tmdb_id")
    .maybeSingle();
  if (error) {
    console.error("Cancelling a watch night failed", error);
    return { error: t.nights.errors.cancelFailed };
  }
  if (data && Date.parse(data.starts_at) > Date.now()) {
    const title = isMediaType(data.media_type) && data.tmdb_id ? { media_type: data.media_type, tmdb_id: data.tmdb_id } : null;
    await notifyLater("cancelled", { id: data.id, starts_at: data.starts_at, title }, profile);
  }
  refresh();
  redirect("/watch-nights");
}
