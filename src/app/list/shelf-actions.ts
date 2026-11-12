"use server";

import { refresh } from "next/cache";
import { after } from "next/server";
import { headers } from "next/headers";
import { isSeason } from "@/lib/diary-rules";
import { getI18n } from "@/lib/i18n/server";
import { cacheForCouple, getListItem } from "@/lib/list";
import type { ListStatus } from "@/lib/list-rules";
import { pushSend } from "@/lib/shelf";
import {
  cleanSeasonReview,
  cleanSendNote,
  isSendAnswer,
  MAX_SEASON_REVIEW,
  MAX_SEND_NOTE,
  shelfMove,
  statusForAnswer,
  UP_NEXT_STATUSES,
  type SendAnswer,
} from "@/lib/shelf-rules";
import { getPartner, requireCoupleProfile } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { isMediaType, type MediaType, type TitleRef } from "@/lib/watch";
import { addToList, type ListResult } from "./actions";

// Sprint 21: the Someday shelf, sending a title to your partner and hidden season reviews. Everything runs as
// the signed-in user, so RLS limits it to their couple (and to answering only what was sent to them).

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isTitleRef(ref: unknown): ref is TitleRef {
  const r = ref as TitleRef | null;
  return Boolean(r) && isMediaType(r!.media_type) && Number.isSafeInteger(r!.tmdb_id) && r!.tmdb_id > 0;
}

// ---------------------------------------------------------------------------------------------------------
// The Someday shelf
// ---------------------------------------------------------------------------------------------------------

/**
 * One tap: puts an Up next title on the Someday shelf, or moves a shelved one back (to Watching if a series
 * was started). `to` says which way was meant, so a tap that crosses a change on the other screen does
 * nothing rather than flipping it back.
 */
export async function moveShelf(itemId: string, to: "someday" | "next"): Promise<ListResult> {
  await requireCoupleProfile();
  const { t } = await getI18n();
  if (!UUID.test(itemId) || (to !== "someday" && to !== "next")) return { error: t.title.errors.noSuchItem };

  const supabase = await createClient();
  const { data: item, error: readError } = await supabase
    .from("list_items")
    .select("status, season, episode")
    .eq("id", itemId)
    .maybeSingle();
  if (readError) {
    console.error("Reading a list item to shelve failed", readError);
    return { error: t.shelf.shelf.failed };
  }
  if (!item) return { error: t.title.errors.gone };
  const status = item.status as ListStatus;
  if ((to === "someday") === (status === "someday")) return {};
  const next = shelfMove({ status, season: item.season, episode: item.episode });
  if (!next) return {};

  const { error } = await supabase.from("list_items").update({ status: next }).eq("id", itemId).eq("status", status);
  if (error) {
    console.error("Moving a list item to or from the shelf failed", error);
    return { error: t.shelf.shelf.failed };
  }
  refresh();
  return {};
}

// ---------------------------------------------------------------------------------------------------------
// Sending a title
// ---------------------------------------------------------------------------------------------------------

/** Sends your partner a title with an optional note: a push now, and a card on their Home until they answer. */
export async function sendTitle(ref: TitleRef, note: string): Promise<ListResult> {
  const profile = await requireCoupleProfile();
  const { t } = await getI18n();
  const e = t.shelf.send.errors;
  if (!isTitleRef(ref)) return { error: t.title.errors.notATitle };
  const clean = cleanSendNote(note);
  if (clean === null) return { error: e.tooLong(MAX_SEND_NOTE) };
  const partner = await getPartner();
  if (!partner) return { error: e.noPartner };

  const key = { media_type: ref.media_type, tmdb_id: ref.tmdb_id };
  const cached = await cacheForCouple(key, profile);
  if (cached === "unknown") return { error: t.title.errors.unknownTitle };
  if (cached === "failed") return { error: t.title.errors.tmdbDown };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("title_sends")
    .insert({ ...key, couple_id: profile.couple_id, from_profile: profile.id, to_profile: partner.id, note: clean })
    .select("id")
    .single();
  if (error) {
    // 23505: one waiting send per title, perhaps from a second tap.
    if (error.code === "23505") return { error: e.already };
    console.error("Sending a title failed", error);
    return { error: e.failed };
  }
  const contact = (await headers()).get("origin");
  if (contact) after(() => pushSend({ ...key, id: data.id, note: clean }, profile, contact));
  refresh();
  return {};
}

/** Takes back a send your partner hasn't answered yet. */
export async function takeBackSend(id: string): Promise<ListResult> {
  const profile = await requireCoupleProfile();
  const { t } = await getI18n();
  if (!UUID.test(id)) return { error: t.shelf.send.errors.gone };
  const supabase = await createClient();
  const { error } = await supabase.from("title_sends").delete().eq("id", id).eq("from_profile", profile.id).is("answer", null);
  if (error) {
    console.error("Taking back a send failed", error);
    return { error: t.shelf.send.errors.failed };
  }
  refresh();
  return {};
}

/**
 * Answers a title your partner sent you: "added" puts it in Up next, "shelved" on the Someday shelf (adding
 * it to the list with their note if it isn't there), "waved" leaves the list alone. Either way the card goes.
 */
export async function answerSend(id: string, answer: SendAnswer): Promise<ListResult> {
  const profile = await requireCoupleProfile();
  const { t } = await getI18n();
  const e = t.shelf.send.errors;
  if (!UUID.test(id) || !isSendAnswer(answer)) return { error: e.gone };

  const supabase = await createClient();
  const { data: send, error: readError } = await supabase
    .from("title_sends")
    .select("media_type, tmdb_id, note, answer, to_profile")
    .eq("id", id)
    .maybeSingle();
  if (readError) {
    console.error("Reading a send failed", readError);
    return { error: e.answerFailed };
  }
  if (!send || send.answer !== null || send.to_profile !== profile.id) return { error: e.gone };

  const status = statusForAnswer(answer);
  if (status) {
    const ref = { media_type: send.media_type as MediaType, tmdb_id: send.tmdb_id };
    const item = await getListItem(profile.couple_id, ref);
    if (!item) {
      const added = await addToList(ref, send.note);
      if (added.error) return added;
    }
    // Already on the list (or just added as Want to watch): move it to where the answer says, but never
    // take a watched or dropped title back.
    const from = item ? item.status : "want";
    const moves = status === "someday" ? UP_NEXT_STATUSES.includes(from) : from === "someday";
    if (moves) {
      const { error } = await supabase
        .from("list_items")
        .update({ status })
        .eq("couple_id", profile.couple_id)
        .eq("media_type", ref.media_type)
        .eq("tmdb_id", ref.tmdb_id);
      if (error) {
        console.error("Moving a sent title failed", error);
        return { error: e.answerFailed };
      }
    }
  }

  const { error } = await supabase.from("title_sends").update({ answer }).eq("id", id).is("answer", null);
  if (error) {
    console.error("Answering a send failed", error);
    return { error: e.answerFailed };
  }
  refresh();
  return {};
}

// ---------------------------------------------------------------------------------------------------------
// Hidden season reviews
// ---------------------------------------------------------------------------------------------------------

/** Your own review of one season. An empty one removes it (which hides your partner's again). */
export async function saveSeasonReview(listItemId: string, season: number, body: string): Promise<ListResult> {
  const profile = await requireCoupleProfile();
  const { t } = await getI18n();
  const s = t.shelf.seasonReview;
  if (!UUID.test(listItemId) || !isSeason(season)) return { error: t.title.errors.noSuchItem };
  const review = cleanSeasonReview(body);
  if (review === null) return { error: s.tooLong(MAX_SEASON_REVIEW) };

  const supabase = await createClient();
  const mine = { list_item_id: listItemId, profile_id: profile.id, season };
  let error;
  if (!review) {
    ({ error } = await supabase.from("season_reviews").delete().match(mine));
  } else {
    // Update first: users may change only the body, which rules out an upsert.
    const updated = await supabase.from("season_reviews").update({ body: review }).match(mine).select("body");
    error = updated.error;
    if (!error && !updated.data?.length) {
      ({ error } = await supabase.from("season_reviews").insert({ ...mine, couple_id: profile.couple_id, body: review }));
    }
  }
  if (error) {
    console.error("Saving a season review failed", error);
    return { error: error.code === "23503" ? t.title.errors.gone : s.failed };
  }
  refresh();
  return {};
}
