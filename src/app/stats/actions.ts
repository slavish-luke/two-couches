"use server";

import { refresh } from "next/cache";
import { getI18n } from "@/lib/i18n/server";
import { requireCoupleProfile } from "@/lib/session";
import type { TablesInsert } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";

// Runs as the signed-in user, so RLS limits it to their couple's list.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Your guess at your partner's rating of a watched title (1-5), or null for "Just show me". Once only; the
 * database fills in their real rating at that moment (`actual`), and refuses when they haven't rated it.
 */
export async function saveGuess(itemId: string, guess: number | null): Promise<{ error?: string }> {
  const profile = await requireCoupleProfile();
  const { t } = await getI18n();
  if (!UUID.test(itemId)) return { error: t.title.errors.noSuchItem };
  if (guess !== null && !(Number.isInteger(guess) && guess >= 1 && guess <= 5)) return { error: t.title.errors.ratingRange };

  const supabase = await createClient();
  // `actual` is set by the database's trigger (users can't write it), so it's left out here.
  const row = { list_item_id: itemId, couple_id: profile.couple_id, profile_id: profile.id, guess };
  const { error } = await supabase.from("rating_guesses").insert(row as TablesInsert<"rating_guesses">);
  // 23505: already guessed, perhaps on another screen a moment ago.
  if (error && error.code !== "23505") {
    console.error("Saving a rating guess failed", error);
    return { error: t.stats.guess.failed };
  }
  refresh();
  return {};
}
