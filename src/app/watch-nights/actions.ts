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
  UNDER_WAY_MS,
  zonedToUtc,
  type NightMethod,
} from "@/lib/night-rules";
import { notifyPartner, type NightChange } from "@/lib/nights";
import { cleanPrepLabel, MAX_PREP_ITEMS, MAX_PREP_LABEL_LENGTH, MAX_PROPOSAL_TIMES, MIN_PROPOSAL_TIMES } from "@/lib/planning-rules";
import { cleanFileLabel, MAX_FILE_LABEL_LENGTH, parseLength } from "@/lib/ready-rules";
import { requireCoupleProfile } from "@/lib/session";
import type { Database } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";
import { clearNightPhotos } from "@/lib/together";
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

type Messages = Awaited<ReturnType<typeof getI18n>>["t"];

/** A start on the planner's own clock as an instant, or an error if it isn't a time or is too far ahead. */
function startFrom(date: unknown, time: unknown, profile: Profile, t: Messages): { start: Date } | { error: string } {
  if (!isDateString(date) || !isTimeString(time)) return { error: t.nights.errors.pickTime };
  const start = zonedToUtc(date, time, profile.time_zone);
  if (start.getTime() > Date.now() + MAX_DAYS_AHEAD * 24 * 60 * 60 * 1000) return { error: t.nights.errors.tooFar };
  return { start };
}

/** What a night (or a proposal of one) is for and how you'll watch, checked and trimmed. */
function detailsFrom(input: Omit<NightInput, "date" | "time">, t: Messages) {
  const errors = t.nights.errors;
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
  return { title, method, link, server, room, notes };
}

/** Caches a night's title for both of you, or says why it can't. */
async function cacheTitle(title: TitleRef | null, profile: Profile, t: Messages) {
  if (!title) return null;
  const cached = await cacheForCouple(title, profile);
  if (cached === "unknown") return t.title.errors.unknownTitle;
  if (cached === "failed") return t.title.errors.tmdbDown;
  return null;
}

/** Plans a new watch night (`id` null) or changes one, then goes back to the calendar. */
export async function saveWatchNight(id: string | null, input: NightInput): Promise<NightResult> {
  const profile = await requireCoupleProfile();
  const { t } = await getI18n();
  const errors = t.nights.errors;
  if (id !== null && !UUID.test(id)) return { error: errors.gone };

  const when = startFrom(input?.date, input?.time, profile, t);
  if ("error" in when) return when;
  const startsAt = when.start;
  const details = detailsFrom(input, t);
  if ("error" in details) return { error: details.error };
  const { title, method, link, server, room, notes } = details;

  const supabase = await createClient();
  const before = id
    ? (
        await supabase
          .from("watch_nights")
          .select("starts_at, media_type, tmdb_id, method, ready_checks(profile_id, ready_at)")
          .eq("id", id)
          .maybeSingle()
      ).data
    : null;
  if (id && !before) return { error: errors.gone };
  const moved = !before || Date.parse(before.starts_at) !== startsAt.getTime();
  // Editing the note of a night that's under way is fine; moving one into the past isn't.
  if (moved && startsAt.getTime() < Date.now() - PAST_GRACE_MS) return { error: errors.inPast };

  const uncached = await cacheTitle(title, profile, t);
  if (uncached) return { error: uncached };

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
  // A new title or method clears the ready checks (a trigger does it), so a partner who was ready hears why.
  const unreadied =
    before &&
    (retitled || before.method !== method) &&
    before.ready_checks.some((c) => c.profile_id !== profile.id && c.ready_at);
  if (!before || moved || retitled || unreadied) {
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
  // Sprint 20: the night's album files don't go with the row.
  if (data) await clearNightPhotos(profile.couple_id, data.id);
  if (data && Date.parse(data.starts_at) > Date.now()) {
    const title = isMediaType(data.media_type) && data.tmdb_id ? { media_type: data.media_type, tmdb_id: data.tmdb_id } : null;
    await notifyLater("cancelled", { id: data.id, starts_at: data.starts_at, title }, profile);
  }
  refresh();
  redirect("/watch-nights");
}

type CheckFields = Pick<Database["public"]["Tables"]["ready_checks"]["Update"], "ready_at" | "file_label" | "file_seconds">;

/**
 * Loads one of the couple's nights that isn't over yet, with who's ready, then saves your own check.
 * Returns the night, or an error message.
 */
async function saveCheck(nightId: string, fields: CheckFields, profile: Profile) {
  const { t } = await getI18n();
  const errors = t.nights.errors;
  if (!UUID.test(nightId)) return { error: errors.gone };

  const supabase = await createClient();
  const { data: night, error: loadError } = await supabase
    .from("watch_nights")
    .select("id, starts_at, media_type, tmdb_id, ready_checks(profile_id, ready_at)")
    .eq("id", nightId)
    .maybeSingle();
  if (loadError) console.error("Loading a watch night failed", loadError);
  if (!night) return { error: loadError ? t.nights.ready.errors.saveFailed : errors.gone };
  if (Date.parse(night.starts_at) < Date.now() - UNDER_WAY_MS) return { error: t.nights.ready.errors.over };

  // Update first: users may change only these columns of their row, which rules out an upsert.
  const mine = { watch_night_id: nightId, profile_id: profile.id };
  const updated = await supabase.from("ready_checks").update(fields).match(mine).select("profile_id");
  let error = updated.error;
  if (!error && !updated.data?.length) {
    ({ error } = await supabase.from("ready_checks").insert({ ...mine, couple_id: profile.couple_id, ...fields }));
  }
  if (error) {
    console.error("Saving a ready check failed", error);
    // The night was cancelled in between.
    return { error: error.code === "23503" ? errors.gone : t.nights.ready.errors.saveFailed };
  }
  return { night };
}

/** Says you're ready for a watch night, or not after all. Tells your partner when you become ready. */
export async function setReady(nightId: string, ready: boolean): Promise<NightResult> {
  const profile = await requireCoupleProfile();
  const result = await saveCheck(nightId, { ready_at: ready ? new Date().toISOString() : null }, profile);
  if (!result.night) return result;

  const { night } = result;
  const wasReady = night.ready_checks.some((c) => c.profile_id === profile.id && c.ready_at);
  if (ready && !wasReady) {
    const partnerReady = night.ready_checks.some((c) => c.profile_id !== profile.id && c.ready_at);
    const title = isMediaType(night.media_type) && night.tmdb_id ? { media_type: night.media_type, tmdb_id: night.tmdb_id } : null;
    await notifyLater(partnerReady ? "bothReady" : "ready", { id: night.id, starts_at: night.starts_at, title }, profile);
  }
  refresh();
  return {};
}

export type FileInput = { label: string; length: string };

/** Saves which version of the file you have and how long it is, so you can both check they match. */
export async function saveFile(nightId: string, input: FileInput): Promise<NightResult> {
  const profile = await requireCoupleProfile();
  const { t } = await getI18n();
  const errors = t.nights.ready.errors;
  const label = cleanFileLabel(input?.label);
  if (label === null) return { error: errors.badLabel(MAX_FILE_LABEL_LENGTH) };
  const seconds = parseLength(input.length);
  if (seconds === undefined) return { error: errors.badLength };

  const result = await saveCheck(nightId, { file_label: label, file_seconds: seconds }, profile);
  if (!result.night) return result;
  refresh();
  return {};
}

// ---------------------------------------------------------------------------------------------------------
// Proposals: two or three times for your partner to pick from
// ---------------------------------------------------------------------------------------------------------

export type ProposalInput = Omit<NightInput, "date" | "time"> & {
  /** Each time as a date and time on the proposer's own clock. */
  times: { date: string; time: string }[];
};

function titleOf(row: { media_type: string | null; tmdb_id: number | null }): TitleRef | null {
  return isMediaType(row.media_type) && row.tmdb_id ? { media_type: row.media_type, tmdb_id: row.tmdb_id } : null;
}

/** Suggests two or three times for a watch night; your partner picks one. Then goes back to the calendar. */
export async function proposeNight(input: ProposalInput): Promise<NightResult> {
  const profile = await requireCoupleProfile();
  const { t } = await getI18n();
  const errors = t.nights.errors;

  const times = Array.isArray(input?.times) ? input.times : [];
  if (times.length < MIN_PROPOSAL_TIMES || times.length > MAX_PROPOSAL_TIMES) {
    return { error: errors.needTimes(MIN_PROPOSAL_TIMES, MAX_PROPOSAL_TIMES) };
  }
  const starts: Date[] = [];
  for (const time of times) {
    const when = startFrom(time?.date, time?.time, profile, t);
    if ("error" in when) return when;
    if (when.start.getTime() < Date.now() - PAST_GRACE_MS) return { error: errors.inPast };
    starts.push(when.start);
  }
  if (new Set(starts.map((s) => s.getTime())).size !== starts.length) {
    return { error: errors.needTimes(MIN_PROPOSAL_TIMES, MAX_PROPOSAL_TIMES) };
  }
  const details = detailsFrom(input, t);
  if ("error" in details) return { error: details.error };
  const uncached = await cacheTitle(details.title, profile, t);
  if (uncached) return { error: uncached };

  const iso = starts.toSorted((a, b) => a.getTime() - b.getTime()).map((s) => s.toISOString());
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("night_proposals")
    .insert({
      couple_id: profile.couple_id,
      proposed_by: profile.id,
      media_type: details.title?.media_type ?? null,
      tmdb_id: details.title?.tmdb_id ?? null,
      times: iso,
      method: details.method,
      link: details.link || null,
      syncplay_server: details.server || null,
      syncplay_room: details.room || null,
      notes: details.notes,
    })
    .select("id")
    .single();
  if (error) {
    console.error("Proposing a watch night failed", error);
    return { error: errors.proposeFailed };
  }

  await notifyLater("proposed", { id: data.id, starts_at: iso, title: details.title, tag: `proposal-${data.id}` }, profile);
  refresh();
  redirect("/watch-nights");
}

/**
 * Answers your partner's proposal: `choice` is which time (0-based), which becomes the watch night, or null for
 * none of these. Tells your partner either way.
 */
export async function answerProposal(id: string, choice: number | null): Promise<NightResult> {
  const profile = await requireCoupleProfile();
  const { t } = await getI18n();
  const errors = t.nights.proposal.errors;
  if (!UUID.test(id) || (choice !== null && (!Number.isInteger(choice) || choice < 0 || choice >= MAX_PROPOSAL_TIMES))) {
    return { error: errors.gone };
  }

  const supabase = await createClient();
  const { data: proposal } = await supabase
    .from("night_proposals")
    .select("times, media_type, tmdb_id")
    .eq("id", id)
    .maybeSingle();
  if (!proposal) return { error: errors.gone };
  // Picked in the order the proposal shows them (soonest first), stored in the order they were saved.
  const shown = proposal.times.toSorted();
  const picked = choice === null ? null : shown[choice];
  if (choice !== null && !picked) return { error: errors.gone };

  const { data, error } = await supabase
    .rpc("answer_night_proposal", {
      proposal_id: id,
      // null means none of these; the generated type doesn't know the argument is nullable.
      choice: (picked ? proposal.times.indexOf(picked) + 1 : null) as number,
    })
    .single<{ outcome: string; watch_night_id: string | null }>();
  if (error) {
    console.error("Answering a proposal failed", error);
    return { error: errors.failed };
  }
  if (data.outcome === "answered") return { error: errors.answered };
  if (data.outcome === "passed") return { error: errors.passed };
  if (data.outcome !== "picked" && data.outcome !== "declined") return { error: errors.gone };

  const title = titleOf(proposal);
  if (data.outcome === "picked" && data.watch_night_id && picked) {
    await notifyLater("picked", { id: data.watch_night_id, starts_at: picked, title }, profile);
  } else {
    await notifyLater("declined", { id, starts_at: shown, title, tag: `proposal-${id}` }, profile);
  }
  refresh();
  return {};
}

/** Withdraws your proposal, or puts away one that was answered or ran out of time. */
export async function removeProposal(id: string): Promise<NightResult> {
  await requireCoupleProfile();
  const { t } = await getI18n();
  if (!UUID.test(id)) return { error: t.nights.proposal.errors.gone };
  const supabase = await createClient();
  const { error } = await supabase.from("night_proposals").delete().eq("id", id);
  if (error) {
    console.error("Removing a proposal failed", error);
    return { error: t.nights.proposal.errors.failed };
  }
  refresh();
  return {};
}

// ---------------------------------------------------------------------------------------------------------
// The prep checklist
// ---------------------------------------------------------------------------------------------------------

/** Adds something to get ready for a night that isn't over yet. */
export async function addPrepItem(nightId: string, input: string): Promise<NightResult> {
  const profile = await requireCoupleProfile();
  const { t } = await getI18n();
  const errors = t.nights.prep.errors;
  if (!UUID.test(nightId)) return { error: t.nights.errors.gone };
  const label = cleanPrepLabel(input);
  if (!label) return { error: errors.bad(MAX_PREP_LABEL_LENGTH) };

  const supabase = await createClient();
  const { data: night } = await supabase
    .from("watch_nights")
    .select("starts_at, night_prep_items(count)")
    .eq("id", nightId)
    .maybeSingle();
  if (!night) return { error: t.nights.errors.gone };
  if (Date.parse(night.starts_at) < Date.now() - UNDER_WAY_MS) return { error: t.nights.ready.errors.over };
  if ((night.night_prep_items[0]?.count ?? 0) >= MAX_PREP_ITEMS) return { error: errors.full(MAX_PREP_ITEMS) };

  const { error } = await supabase
    .from("night_prep_items")
    .insert({ watch_night_id: nightId, couple_id: profile.couple_id, label, added_by: profile.id });
  if (error) {
    if (error.code === "23505") return { error: errors.duplicate };
    if (error.code === "23503") return { error: t.nights.errors.gone };
    console.error("Adding a prep item failed", error);
    return { error: errors.failed };
  }
  refresh();
  return {};
}

/** Ticks something on a prep list (in your name), or unticks it. */
export async function setPrepDone(itemId: string, done: boolean): Promise<NightResult> {
  const profile = await requireCoupleProfile();
  const { t } = await getI18n();
  if (!UUID.test(itemId)) return { error: t.nights.prep.errors.failed };
  const supabase = await createClient();
  const { error } = await supabase
    .from("night_prep_items")
    .update(done ? { done_at: new Date().toISOString(), done_by: profile.id } : { done_at: null, done_by: null })
    .eq("id", itemId);
  if (error) {
    console.error("Ticking a prep item failed", error);
    return { error: t.nights.prep.errors.failed };
  }
  refresh();
  return {};
}

/** Takes something off a prep list. */
export async function removePrepItem(itemId: string): Promise<NightResult> {
  await requireCoupleProfile();
  const { t } = await getI18n();
  if (!UUID.test(itemId)) return { error: t.nights.prep.errors.failed };
  const supabase = await createClient();
  const { error } = await supabase.from("night_prep_items").delete().eq("id", itemId);
  if (error) {
    console.error("Removing a prep item failed", error);
    return { error: t.nights.prep.errors.failed };
  }
  refresh();
  return {};
}
