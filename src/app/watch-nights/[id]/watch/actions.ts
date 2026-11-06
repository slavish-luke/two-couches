"use server";

import { getI18n } from "@/lib/i18n/server";
import { getSubtitleFile, searchSubtitles, subtitlesConfigured, type SubtitleOption } from "@/lib/opensubtitles";
import { isLanguage } from "@/lib/places";
import { requireCoupleProfile } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import type { MediaType } from "@/lib/watch";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HASH = /^[0-9a-f]{16}$/;
const MAX_QUERY_LENGTH = 200;

/** The night, if it's one of your couple's (RLS hides the rest). Only members may spend the couple's downloads. */
async function nightFor(nightId: unknown) {
  if (typeof nightId !== "string" || !UUID.test(nightId)) return null;
  await requireCoupleProfile();
  const supabase = await createClient();
  const { data } = await supabase.from("watch_nights").select("media_type, tmdb_id").eq("id", nightId).maybeSingle();
  return data;
}

function episodeNumber(value: unknown) {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 999 ? value : undefined;
}

export type FindResult = { options: SubtitleOption[] } | { error: string };

/**
 * Subtitles for the night's title in one of the app's languages, best first: those timed for your file
 * (its OpenSubtitles `hash`) lead. A night with no title searches by `query` (the file's name).
 */
export async function findSubtitles(
  nightId: string,
  input: { language: string; hash: string | null; season?: number; episode?: number; query?: string },
): Promise<FindResult> {
  const { t } = await getI18n();
  const errors = t.nights.room.find.errors;
  if (!subtitlesConfigured()) return { error: errors.unavailable };
  const night = await nightFor(nightId);
  if (!night) return { error: errors.searchFailed };
  if (!isLanguage(input.language)) return { error: errors.searchFailed };
  const hash = typeof input.hash === "string" && HASH.test(input.hash) ? input.hash : null;

  try {
    if (night.media_type && night.tmdb_id) {
      const options = await searchSubtitles({
        language: input.language,
        hash,
        title: { media_type: night.media_type as MediaType, tmdb_id: night.tmdb_id },
        season: episodeNumber(input.season),
        episode: episodeNumber(input.episode),
      });
      return { options };
    }
    const query = typeof input.query === "string" ? input.query.trim().slice(0, MAX_QUERY_LENGTH) : "";
    if (!query) return { options: [] };
    return { options: await searchSubtitles({ language: input.language, hash, title: null, query }) };
  } catch (error) {
    console.error("Subtitle search failed", error);
    return { error: errors.searchFailed };
  }
}

export type LoadResult = { vtt: string } | { error: string } | { quota: string | null };

/** One subtitle file as WebVTT: cached, or downloaded with one of the account's daily downloads. */
export async function loadSubtitles(nightId: string, input: { fileId: number; language: string; release: string }): Promise<LoadResult> {
  const { t } = await getI18n();
  const errors = t.nights.room.find.errors;
  if (!subtitlesConfigured()) return { error: errors.unavailable };
  if (!(await nightFor(nightId))) return { error: errors.downloadFailed };
  if (!Number.isSafeInteger(input.fileId) || input.fileId <= 0) return { error: errors.downloadFailed };
  const language = typeof input.language === "string" && /^[a-z]{2}(-[a-z]{2})?$/i.test(input.language) ? input.language : "en";
  const release = typeof input.release === "string" ? input.release : "";

  try {
    const file = await getSubtitleFile(input.fileId, language, release);
    if (file.ok) return { vtt: file.vtt };
    return file.reason === "quota" ? { quota: file.resetsAt } : { error: errors.downloadFailed };
  } catch (error) {
    console.error("Subtitle download failed", error);
    return { error: errors.downloadFailed };
  }
}
