"use server";

import { refresh } from "next/cache";
import { addToList, rateListItem, updateListItem, type ListResult } from "@/app/list/actions";
import { getI18n } from "@/lib/i18n/server";
import { getListItem } from "@/lib/list";
import { isProgress, localDate, type Progress } from "@/lib/list-rules";
import { cleanReview, MAX_REVIEW_LENGTH, nightEndsAt } from "@/lib/review-rules";
import { requireCoupleProfile } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import type { MediaType } from "@/lib/watch";

// Everything here runs as the signed-in user, so RLS limits it to their couple and their own rows.

export type ReviewResult = ListResult;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Profile = Awaited<ReturnType<typeof requireCoupleProfile>>;

/** Saves (or, when empty, deletes) your own review. Doesn't refresh. */
async function writeReview(profile: Profile, listItemId: string, body: string): Promise<boolean> {
  const supabase = await createClient();
  const mine = { list_item_id: listItemId, profile_id: profile.id };
  let error;
  if (!body) {
    ({ error } = await supabase.from("list_reviews").delete().match(mine));
  } else {
    // Update first: users may change only the body, which rules out an upsert.
    const updated = await supabase.from("list_reviews").update({ body }).match(mine).select("body");
    error = updated.error;
    if (!error && !updated.data?.length) {
      ({ error } = await supabase.from("list_reviews").insert({ ...mine, couple_id: profile.couple_id, body }));
    }
  }
  if (error) console.error("Saving a review failed", error);
  return !error;
}

/** Your own review of a list item. An empty one removes it (which hides your partner's again). */
export async function saveReview(listItemId: string, body: string): Promise<ReviewResult> {
  const profile = await requireCoupleProfile();
  const { t } = await getI18n();
  if (!UUID.test(listItemId)) return { error: t.reviews.errors.noSuchItem };
  const review = cleanReview(body);
  if (review === null) return { error: t.reviews.errors.tooLong(MAX_REVIEW_LENGTH) };
  if (!(await writeReview(profile, listItemId, review))) return { error: t.reviews.errors.saveFailed };
  refresh();
  return {};
}

export type WrapupInput = {
  /** Films: mark it watched, dated the night's day on your clock. */
  watched?: boolean;
  /** Series: the last episode you watched. */
  progress?: Progress;
  /** Your rating; null clears it. Left alone when it matches what's saved. */
  rating?: number | null;
  /** Your review; "" removes it. */
  review?: string;
};

/** Records that you've dealt with a night's card, so it stops showing for you. */
async function finishWrapup(profile: Profile, nightId: string, outcome: "saved" | "skipped") {
  const supabase = await createClient();
  const { error } = await supabase
    .from("night_wrapups")
    .insert({ watch_night_id: nightId, couple_id: profile.couple_id, profile_id: profile.id, outcome });
  // 23505: already done, perhaps on another screen a moment ago.
  if (error && error.code !== "23505") {
    console.error("Wrapping up a watch night failed", error);
    return false;
  }
  return true;
}

/** "How was it?": marks the film watched or moves the series on, rates and reviews it, then hides the card. */
export async function saveWrapup(nightId: string, input: WrapupInput): Promise<ReviewResult> {
  const profile = await requireCoupleProfile();
  const { t } = await getI18n();
  const errors = t.reviews.errors;
  if (!UUID.test(nightId)) return { error: errors.gone };

  const { rating, watched } = input ?? {};
  if (rating !== undefined && rating !== null && !(Number.isInteger(rating) && rating >= 1 && rating <= 5)) {
    return { error: t.title.errors.ratingRange };
  }
  if (input.progress !== undefined && !isProgress(input.progress)) return { error: t.title.errors.enterProgress };
  const review = input.review === undefined ? undefined : cleanReview(input.review);
  if (review === null) return { error: errors.tooLong(MAX_REVIEW_LENGTH) };

  const supabase = await createClient();
  const { data: night, error } = await supabase
    .from("watch_nights")
    .select("id, starts_at, media_type, tmdb_id, titles(runtime)")
    .eq("id", nightId)
    .maybeSingle();
  if (error) console.error("Loading a watch night failed", error);
  if (!night?.media_type || !night.tmdb_id) return { error: errors.gone };
  const ref = { media_type: night.media_type as MediaType, tmdb_id: night.tmdb_id };
  const runtime = night.titles?.runtime ?? null;
  if (nightEndsAt({ starts_at: night.starts_at, media_type: ref.media_type, runtime }) > new Date()) {
    return { error: errors.notOver };
  }

  let item = await getListItem(profile.couple_id, ref);
  const myRating = item?.ratings[profile.id] ?? null;
  const rate = rating !== undefined && rating !== myRating;
  const markWatched = ref.media_type === "movie" && watched === true && item?.status !== "watched";
  const progress =
    ref.media_type === "tv" &&
    input.progress &&
    (input.progress.season !== item?.season || input.progress.episode !== item?.episode)
      ? input.progress
      : null;

  // A night's title needn't be on the list. Put it there if there's anything to save on it.
  if (!item && (markWatched || progress || rating || review)) {
    const added = await addToList(ref);
    if (added.error) return added;
    item = await getListItem(profile.couple_id, ref);
    if (!item) return { error: errors.saveFailed };
  }

  if (item) {
    const steps: (() => Promise<ListResult>)[] = [];
    if (markWatched) {
      steps.push(() =>
        updateListItem(item.id, {
          status: "watched",
          watched_on: localDate(profile.time_zone, new Date(night.starts_at)),
        }),
      );
    }
    if (progress) {
      // Watching an episode means you've started the series.
      steps.push(() =>
        updateListItem(item.id, { progress, ...(item.status === "want" && { status: "watching" as const }) }),
      );
    }
    if (rate) steps.push(() => rateListItem(item.id, rating ?? null));
    for (const step of steps) {
      const result = await step();
      if (result.error) return result;
    }
    if (review !== undefined && !(await writeReview(profile, item.id, review))) return { error: errors.saveFailed };
  }

  if (!(await finishWrapup(profile, nightId, "saved"))) return { error: errors.saveFailed };
  refresh();
  return {};
}

/** "Not now": hides the night's card for you without changing anything. */
export async function skipWrapup(nightId: string): Promise<ReviewResult> {
  const profile = await requireCoupleProfile();
  const { t } = await getI18n();
  if (!UUID.test(nightId)) return { error: t.reviews.errors.gone };
  if (!(await finishWrapup(profile, nightId, "skipped"))) return { error: t.reviews.errors.saveFailed };
  refresh();
  return {};
}
