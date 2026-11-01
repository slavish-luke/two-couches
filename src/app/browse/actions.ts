"use server";

import { refresh } from "next/cache";
import { getI18n } from "@/lib/i18n/server";
import { requireCoupleProfile } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { isMediaType, type TitleRef } from "@/lib/watch";

// Runs as the signed-in user, so RLS limits it to their couple.

/** Marks a title "not interested" for the couple, so it stops being suggested; `on` false undoes it. */
export async function dismissTitle(ref: TitleRef, on: boolean): Promise<{ error?: string }> {
  const profile = await requireCoupleProfile();
  const { t } = await getI18n();
  if (!isMediaType(ref?.media_type) || !Number.isSafeInteger(ref.tmdb_id) || ref.tmdb_id <= 0) {
    return { error: t.title.errors.notATitle };
  }
  const key = { media_type: ref.media_type, tmdb_id: ref.tmdb_id, couple_id: profile.couple_id };
  const supabase = await createClient();
  const { error } = on
    ? await supabase.from("dismissed_titles").insert({ ...key, dismissed_by: profile.id })
    : await supabase.from("dismissed_titles").delete().match(key);
  // 23505: already dismissed, perhaps by the other person a moment ago.
  if (error && error.code !== "23505") {
    console.error("Saving a dismissal failed", error);
    return { error: t.common.dismiss.failed };
  }
  refresh();
  return {};
}
