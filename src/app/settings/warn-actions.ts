"use server";

import { refresh } from "next/cache";
import { cleanKeywordName, type Keyword } from "@/lib/guidance-rules";
import { getKeyword, searchKeywords } from "@/lib/guidance";
import { getI18n } from "@/lib/i18n/server";
import { requireCoupleProfile, requireProfile } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

// Settings → "Warn me about" (Sprint 19). Runs as the signed-in user: RLS keeps each person to their own list.

/** TMDB keywords ("topics") matching what's typed, for adding to your list. */
export async function findKeywords(query: string): Promise<{ results?: Keyword[]; error?: string }> {
  await requireProfile();
  const { t } = await getI18n();
  const q = typeof query === "string" ? query.replace(/\s+/g, " ").trim() : "";
  if (q.length < 2 || q.length > 60) return { results: [] };
  try {
    return { results: await searchKeywords(q) };
  } catch (error) {
    console.error("Searching TMDB keywords failed", error);
    return { error: t.discovery.warn.searchFailed };
  }
}

/** Adds a TMDB keyword to your list, with its name as TMDB has it (not as sent). */
export async function addWarnKeyword(id: number): Promise<{ error?: string }> {
  const profile = await requireCoupleProfile();
  const { t } = await getI18n();
  if (!Number.isSafeInteger(id) || id <= 0) return { error: t.discovery.warn.failed };
  const keyword = await getKeyword(id);
  const name = cleanKeywordName(keyword?.name);
  if (!keyword || !name) return { error: t.discovery.warn.failed };

  const supabase = await createClient();
  const { error } = await supabase
    .from("warn_keywords")
    .insert({ profile_id: profile.id, couple_id: profile.couple_id, keyword_id: keyword.id, name });
  // 23505: already on the list. 23514: the list is full (30).
  if (error?.code === "23514") return { error: t.discovery.warn.limit };
  if (error && error.code !== "23505") {
    console.error("Adding a keyword to warn about failed", error);
    return { error: t.discovery.warn.failed };
  }
  refresh();
  return {};
}

/** Takes a keyword off your list. */
export async function removeWarnKeyword(id: number): Promise<{ error?: string }> {
  const profile = await requireProfile();
  const { t } = await getI18n();
  if (!Number.isSafeInteger(id)) return { error: t.discovery.warn.failed };
  const supabase = await createClient();
  const { error } = await supabase.from("warn_keywords").delete().match({ profile_id: profile.id, keyword_id: id });
  if (error) {
    console.error("Removing a keyword to warn about failed", error);
    return { error: t.discovery.warn.failed };
  }
  refresh();
  return {};
}
