import "server-only";
import { decodeSubtitles, toWebVtt } from "./room-rules";
import { createAdminClient } from "./supabase/admin";
import type { MediaType } from "./watch";

/**
 * OpenSubtitles (api.opensubtitles.com) for the watch room: search by TMDB ID (and the file's
 * OpenSubtitles hash, so subtitles timed for that exact file come first), and download through a free
 * account the server signs in with (20 a day; anonymous downloads are off for the key). Downloaded files
 * are kept as WebVTT in `subtitle_files`, so each one costs a download only once. Server only: the key
 * and the account are secrets (OPENSUBTITLES_API_KEY, OPENSUBTITLES_USERNAME, OPENSUBTITLES_PASSWORD).
 */

const API = "https://api.opensubtitles.com/api/v1";
// OpenSubtitles asks every app to name itself and its version.
const USER_AGENT = "TwoCouches v1.0";
const SEARCH_REVALIDATE_S = 6 * 60 * 60;
/** Results offered at once. */
const MAX_RESULTS = 12;

export function subtitlesConfigured() {
  return Boolean(process.env.OPENSUBTITLES_API_KEY && process.env.OPENSUBTITLES_USERNAME && process.env.OPENSUBTITLES_PASSWORD);
}

function headers(extra: Record<string, string> = {}) {
  return {
    "Api-Key": process.env.OPENSUBTITLES_API_KEY ?? "",
    "User-Agent": USER_AGENT,
    Accept: "application/json",
    ...extra,
  };
}

export type SubtitleOption = {
  fileId: number;
  language: string;
  /** The release the subtitle was made for, as the uploader named it. */
  release: string;
  downloads: number;
  /** Timed for this exact file (its OpenSubtitles hash matched). */
  matchesFile: boolean;
  hearingImpaired: boolean;
  /** Machine or AI translated: usually worse. */
  machine: boolean;
};

export type SubtitleSearch = {
  language: string;
  /** The OpenSubtitles hash of the viewer's file (16 hex digits), worked out in their browser. */
  hash: string | null;
} & (
  | { title: { media_type: MediaType; tmdb_id: number }; season?: number; episode?: number }
  | { title: null; query: string }
);

type SearchResponse = {
  data?: {
    attributes: {
      language: string;
      download_count: number;
      hearing_impaired: boolean;
      foreign_parts_only: boolean;
      ai_translated: boolean;
      machine_translated: boolean;
      moviehash_match?: boolean;
      release: string;
      files: { file_id: number }[];
    };
  }[];
};

/** Subtitles for a title (or a file name, when the night has no title), best first. */
export async function searchSubtitles(search: SubtitleSearch): Promise<SubtitleOption[]> {
  // OpenSubtitles redirects requests whose parameters aren't sorted and lower case, so build them sorted.
  const params: Record<string, string> = { languages: search.language };
  if (search.hash) params.moviehash = search.hash;
  if (search.title?.media_type === "tv") {
    params.parent_tmdb_id = String(search.title.tmdb_id);
    params.type = "episode";
    if ("season" in search && search.season) params.season_number = String(search.season);
    if ("episode" in search && search.episode) params.episode_number = String(search.episode);
  } else if (search.title) {
    params.tmdb_id = String(search.title.tmdb_id);
    params.type = "movie";
  } else {
    params.query = search.query.toLowerCase();
  }
  const query = new URLSearchParams(Object.entries(params).sort(([a], [b]) => a.localeCompare(b))).toString();

  const response = await fetch(`${API}/subtitles?${query}`, { headers: headers(), next: { revalidate: SEARCH_REVALIDATE_S } });
  if (!response.ok) throw new Error(`OpenSubtitles search failed: ${response.status}`);
  const body = (await response.json()) as SearchResponse;

  return (body.data ?? [])
    .filter((d) => !d.attributes.foreign_parts_only && d.attributes.files.length === 1)
    .map(({ attributes: a }) => ({
      fileId: a.files[0].file_id,
      language: a.language,
      release: a.release.slice(0, 300),
      downloads: a.download_count,
      matchesFile: a.moviehash_match === true,
      hearingImpaired: a.hearing_impaired,
      machine: a.ai_translated || a.machine_translated,
    }))
    .sort(
      (x, y) =>
        Number(y.matchesFile) - Number(x.matchesFile) || Number(x.machine) - Number(y.machine) || y.downloads - x.downloads,
    )
    .slice(0, MAX_RESULTS);
}

/** The signed-in session, kept for the life of this server instance (tokens last a day). */
let session: { token: string; base: string; at: number } | null = null;
const SESSION_MS = 12 * 60 * 60 * 1000;

async function signIn(fresh = false) {
  if (!fresh && session && Date.now() - session.at < SESSION_MS) return session;
  const response = await fetch(`${API}/login`, {
    method: "POST",
    headers: headers({ "Content-Type": "application/json" }),
    body: JSON.stringify({ username: process.env.OPENSUBTITLES_USERNAME, password: process.env.OPENSUBTITLES_PASSWORD }),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`OpenSubtitles sign-in failed: ${response.status}`);
  const body = (await response.json()) as { token: string; base_url?: string };
  // Accounts can be sent to another API host (e.g. VIP); use it for downloads.
  const base = body.base_url ? `https://${body.base_url.replace(/^https?:\/\//, "")}/api/v1` : API;
  session = { token: body.token, base, at: Date.now() };
  return session;
}

export type SubtitleFile = { ok: true; vtt: string } | { ok: false; reason: "quota"; resetsAt: string | null } | { ok: false; reason: "failed" };

/**
 * A subtitle file as WebVTT: from the cache, or downloaded (one of the account's daily downloads) and
 * cached. `language` and `release` are only recorded with it.
 */
export async function getSubtitleFile(fileId: number, language: string, release: string): Promise<SubtitleFile> {
  // Without the secret key there's no cache: every pick is a download.
  const admin = createAdminClient();
  const cached = admin ? await admin.from("subtitle_files").select("vtt").eq("file_id", fileId).maybeSingle() : null;
  if (cached?.data) return { ok: true, vtt: cached.data.vtt };

  const ask = async (fresh: boolean) => {
    const { token, base } = await signIn(fresh);
    return fetch(`${base}/download`, {
      method: "POST",
      headers: headers({ "Content-Type": "application/json", Authorization: `Bearer ${token}` }),
      body: JSON.stringify({ file_id: fileId }),
      cache: "no-store",
    });
  };
  let response = await ask(false);
  // An expired or revoked token: sign in again once.
  if (response.status === 401) response = await ask(true);
  const body = (await response.json().catch(() => ({}))) as { link?: string; remaining?: number; reset_time_utc?: string; message?: string };
  if (!response.ok || !body.link) {
    // Out of downloads for today answers 406 with the time the count resets.
    if (response.status === 406 || body.remaining === 0) return { ok: false, reason: "quota", resetsAt: body.reset_time_utc ?? null };
    console.error("OpenSubtitles download failed", response.status, body.message);
    return { ok: false, reason: "failed" };
  }

  const file = await fetch(body.link, { cache: "no-store" });
  if (!file.ok) return { ok: false, reason: "failed" };
  const vtt = toWebVtt(decodeSubtitles(await file.arrayBuffer()));
  if (!vtt.includes("-->")) return { ok: false, reason: "failed" };
  if (admin) {
    const row = { file_id: fileId, language: language.slice(0, 5).toLowerCase(), release: release.slice(0, 300), vtt };
    const { error } = await admin.from("subtitle_files").upsert(row);
    if (error) console.error("Couldn't cache subtitles", error);
  }
  return { ok: true, vtt };
}
