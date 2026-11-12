"use server";

import { refresh } from "next/cache";
import { headers } from "next/headers";
import { after } from "next/server";
import { getI18n } from "@/lib/i18n/server";
import { requireCoupleProfile } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { pushToPartner } from "@/lib/together";
import {
  cleanAnswer,
  cleanComment,
  cleanEpisodeNote,
  isDayString,
  isEpisodeWatched,
  isNudgeKind,
  isReaction,
  MAX_ANSWER_LENGTH,
  MAX_COMMENT_LENGTH,
  MAX_PHOTOS_PER_NIGHT,
  NUDGE_GAP_MS,
  nudgeWait,
  PHOTO_BUCKET,
  photoPaths,
  questionIndex,
  utcDay,
  type NudgeKind,
  type Reaction,
} from "@/lib/together-rules";

// Everything here runs as the signed-in user, so RLS limits it to their couple (and hides what it should).

export type TogetherResult = { error?: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Profile = Awaited<ReturnType<typeof requireCoupleProfile>>;

/** Pushes to the partner once the response is sent, so a slow push service doesn't hold anything up. */
async function pushLater(profile: Profile, build: Parameters<typeof pushToPartner>[1]) {
  const contact = (await headers()).get("origin");
  if (!contact) return;
  after(() => pushToPartner(profile, build, contact));
}

// ---------------------------------------------------------------------------------------------------------
// Nudges
// ---------------------------------------------------------------------------------------------------------

/** Sends your partner a heart, "starting soon" or "ready when you are". One a minute. */
export async function sendNudge(kind: NudgeKind): Promise<TogetherResult & { waitMs?: number }> {
  const profile = await requireCoupleProfile();
  const { t } = await getI18n();
  const text = t.together.nudge;
  if (!isNudgeKind(kind)) return { error: text.failed };

  const supabase = await createClient();
  const [{ data: partner }, { data: last }] = await Promise.all([
    supabase.from("profiles").select("id").eq("couple_id", profile.couple_id).neq("id", profile.id).maybeSingle(),
    supabase
      .from("nudges")
      .select("sent_at")
      .eq("from_profile", profile.id)
      .order("sent_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  if (!partner) return { error: text.failed };
  const wait = nudgeWait(last?.sent_at ?? null, Date.now());
  if (wait > 0) return { error: text.tooSoon(Math.ceil(wait / 1000)), waitMs: wait };

  const { error } = await supabase
    .from("nudges")
    .insert({ couple_id: profile.couple_id, from_profile: profile.id, to_profile: partner.id, kind });
  if (error) {
    // The database's own once-a-minute check (two taps racing).
    if (error.code === "23514") return { error: text.tooSoon(60), waitMs: NUDGE_GAP_MS };
    console.error("Sending a nudge failed", error);
    return { error: text.failed };
  }
  await pushLater(profile, (pt, name) => ({
    title: pt.together.nudge.push[kind].title(name),
    body: pt.together.nudge.push[kind].body,
    url: "/",
    tag: `nudge-${profile.id}`,
  }));
  refresh();
  return {};
}

/** Marks nudges sent to you as seen, up to and including this one. */
export async function seeNudge(id: string): Promise<TogetherResult> {
  const profile = await requireCoupleProfile();
  if (!UUID.test(id)) return {};
  const supabase = await createClient();
  const { data: nudge } = await supabase.from("nudges").select("sent_at").eq("id", id).maybeSingle();
  if (!nudge) return {};
  const { error } = await supabase
    .from("nudges")
    .update({ seen_at: new Date().toISOString() })
    .eq("to_profile", profile.id)
    .is("seen_at", null)
    .lte("sent_at", nudge.sent_at);
  if (error) console.error("Marking a nudge seen failed", error);
  refresh();
  return {};
}

// ---------------------------------------------------------------------------------------------------------
// Tonight's question
// ---------------------------------------------------------------------------------------------------------

/** Saves (or changes) your answer to a day's question: today's, or an earlier one answered late. */
export async function answerQuestion(day: string, input: string): Promise<TogetherResult> {
  const profile = await requireCoupleProfile();
  const { t } = await getI18n();
  const errors = t.together.question.errors;
  if (!isDayString(day)) return { error: errors.saveFailed };
  if (day > utcDay(new Date())) return { error: errors.notYet };
  if (input.trim().length > MAX_ANSWER_LENGTH + 20) return { error: errors.tooLong(MAX_ANSWER_LENGTH) };
  const body = cleanAnswer(input);
  if (!body) return { error: errors.saveFailed };

  const supabase = await createClient();
  const mine = { profile_id: profile.id, day };
  // Update first: users may change only the body of their row, which rules out an upsert.
  const updated = await supabase.from("question_answers").update({ body }).match(mine).select("day");
  let error = updated.error;
  const isNew = !error && !updated.data?.length;
  if (isNew) {
    ({ error } = await supabase.from("question_answers").insert({
      ...mine,
      couple_id: profile.couple_id,
      question: questionIndex(day, t.together.question.questions.length),
      body,
    }));
  }
  if (error) {
    console.error("Saving an answer failed", error);
    return { error: errors.saveFailed };
  }
  if (isNew && day === utcDay(new Date())) {
    // Whether they've answered too decides what the push asks of them.
    const { data: theirs } = await supabase
      .from("question_signals")
      .select("profile_id")
      .eq("couple_id", profile.couple_id)
      .eq("day", day)
      .neq("profile_id", profile.id)
      .maybeSingle();
    await pushLater(profile, (pt, name) => ({
      title: pt.together.question.push.title(name),
      body: theirs ? pt.together.question.push.bodyShown : pt.together.question.push.bodyHidden,
      url: "/",
      tag: `question-${day}`,
    }));
  }
  refresh();
  return {};
}

// ---------------------------------------------------------------------------------------------------------
// Comments
// ---------------------------------------------------------------------------------------------------------

export type CommentTarget = { listItemId: string } | { nightId: string };

/** Adds a comment to a list item's or a watch night's thread. */
export async function addComment(target: CommentTarget, input: string): Promise<TogetherResult> {
  const profile = await requireCoupleProfile();
  const { t } = await getI18n();
  const errors = t.together.comments.errors;
  const listItemId = "listItemId" in target ? target.listItemId : null;
  const nightId = "nightId" in target ? target.nightId : null;
  if (!UUID.test(listItemId ?? nightId ?? "")) return { error: errors.gone };
  if (input.trim().length > MAX_COMMENT_LENGTH) return { error: errors.tooLong(MAX_COMMENT_LENGTH) };
  const body = cleanComment(input);
  if (!body) return { error: errors.saveFailed };

  const supabase = await createClient();
  const { error } = await supabase.from("comments").insert({
    couple_id: profile.couple_id,
    list_item_id: listItemId,
    watch_night_id: nightId,
    profile_id: profile.id,
    body,
  });
  if (error) {
    if (error.code === "23503") return { error: errors.gone };
    console.error("Adding a comment failed", error);
    return { error: errors.saveFailed };
  }
  refresh();
  return {};
}

/** Deletes one of your own comments. */
export async function removeComment(id: string): Promise<TogetherResult> {
  await requireCoupleProfile();
  const { t } = await getI18n();
  if (!UUID.test(id)) return { error: t.together.comments.errors.gone };
  const supabase = await createClient();
  const { error } = await supabase.from("comments").delete().eq("id", id);
  if (error) {
    console.error("Deleting a comment failed", error);
    return { error: t.together.comments.errors.saveFailed };
  }
  refresh();
  return {};
}

/** Sets your sticker on a comment (one each), or takes it back with null. */
export async function reactToComment(commentId: string, kind: Reaction | null): Promise<TogetherResult> {
  const profile = await requireCoupleProfile();
  const { t } = await getI18n();
  const errors = t.together.comments.errors;
  if (!UUID.test(commentId) || (kind !== null && !isReaction(kind))) return { error: errors.saveFailed };

  const supabase = await createClient();
  const mine = { comment_id: commentId, profile_id: profile.id };
  let error;
  if (kind === null) {
    ({ error } = await supabase.from("comment_reactions").delete().match(mine));
  } else {
    const updated = await supabase.from("comment_reactions").update({ kind }).match(mine).select("kind");
    error = updated.error;
    if (!error && !updated.data?.length) {
      ({ error } = await supabase.from("comment_reactions").insert({ ...mine, couple_id: profile.couple_id, kind }));
    }
  }
  if (error) {
    if (error.code === "23503") return { error: errors.gone };
    console.error("Reacting to a comment failed", error);
    return { error: errors.saveFailed };
  }
  refresh();
  return {};
}

// ---------------------------------------------------------------------------------------------------------
// Episode reactions
// ---------------------------------------------------------------------------------------------------------

/** Sets your hidden sticker and line on an episode you've watched, or takes it back with a null kind. */
export async function reactToEpisode(
  listItemId: string,
  season: number,
  episode: number,
  kind: Reaction | null,
  note: string,
): Promise<TogetherResult> {
  const profile = await requireCoupleProfile();
  const { t } = await getI18n();
  const errors = t.together.episodes.errors;
  const valid =
    UUID.test(listItemId) &&
    Number.isInteger(season) &&
    Number.isInteger(episode) &&
    season >= 1 &&
    season <= 999 &&
    episode >= 1 &&
    episode <= 9999 &&
    (kind === null || isReaction(kind));
  if (!valid) return { error: errors.saveFailed };

  const supabase = await createClient();
  const mine = { list_item_id: listItemId, profile_id: profile.id, season, episode };
  if (kind === null) {
    const { error } = await supabase.from("episode_reactions").delete().match(mine);
    if (error) {
      console.error("Removing an episode reaction failed", error);
      return { error: errors.saveFailed };
    }
    refresh();
    return {};
  }

  const { data: item } = await supabase
    .from("list_items")
    .select("status, season, episode, media_type")
    .eq("id", listItemId)
    .maybeSingle();
  if (!item || item.media_type !== "tv" || !isEpisodeWatched(item, season, episode)) return { error: errors.notWatched };

  const fields = { kind, note: cleanEpisodeNote(note) };
  const updated = await supabase.from("episode_reactions").update(fields).match(mine).select("kind");
  let error = updated.error;
  if (!error && !updated.data?.length) {
    ({ error } = await supabase.from("episode_reactions").insert({ ...mine, couple_id: profile.couple_id, ...fields }));
  }
  if (error) {
    // 42501: the policy's own watched check (the progress moved back in between).
    if (error.code === "42501") return { error: errors.notWatched };
    console.error("Saving an episode reaction failed", error);
    return { error: errors.saveFailed };
  }
  refresh();
  return {};
}

// ---------------------------------------------------------------------------------------------------------
// Photos
// ---------------------------------------------------------------------------------------------------------

export type PhotoInput = {
  id: string;
  nightId: string;
  extension: "webp" | "jpg";
  bytes: number;
  width: number;
  height: number;
};

/**
 * Records a photo the browser has just uploaded (both files, to the couple's folder for this night). If the
 * album is full or the couple is out of space, the files are removed again.
 */
export async function addNightPhoto(input: PhotoInput): Promise<TogetherResult> {
  const profile = await requireCoupleProfile();
  const { t } = await getI18n();
  const errors = t.together.album.errors;
  const valid =
    UUID.test(input.id) &&
    UUID.test(input.nightId) &&
    (input.extension === "webp" || input.extension === "jpg") &&
    [input.bytes, input.width, input.height].every((n) => Number.isInteger(n) && n > 0);
  if (!valid) return { error: errors.uploadFailed };

  const supabase = await createClient();
  const paths = photoPaths(profile.couple_id, input.nightId, input.id, input.extension);
  const { error } = await supabase.from("night_photos").insert({
    id: input.id,
    watch_night_id: input.nightId,
    couple_id: profile.couple_id,
    uploaded_by: profile.id,
    ...paths,
    bytes: input.bytes,
    width: input.width,
    height: input.height,
  });
  if (error) {
    await supabase.storage.from(PHOTO_BUCKET).remove([paths.path, paths.thumb_path]);
    if (error.code === "23514") {
      return { error: error.message.includes("photo_space_full") ? errors.space : errors.full(MAX_PHOTOS_PER_NIGHT) };
    }
    console.error("Recording a night photo failed", error);
    return { error: errors.uploadFailed };
  }
  refresh();
  return {};
}

/** Deletes one of your own photos, files and all. */
export async function removeNightPhoto(id: string): Promise<TogetherResult> {
  const profile = await requireCoupleProfile();
  const { t } = await getI18n();
  if (!UUID.test(id)) return { error: t.together.album.errors.removeFailed };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("night_photos")
    .delete()
    .eq("id", id)
    .eq("uploaded_by", profile.id)
    .select("path, thumb_path")
    .maybeSingle();
  if (error || !data) {
    if (error) console.error("Deleting a night photo failed", error);
    return { error: t.together.album.errors.removeFailed };
  }
  const removed = await supabase.storage.from(PHOTO_BUCKET).remove([data.path, data.thumb_path]);
  if (removed.error) console.error("Deleting a night photo's files failed", removed.error);
  refresh();
  return {};
}
