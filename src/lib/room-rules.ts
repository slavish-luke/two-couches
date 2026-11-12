/**
 * Watch room rules: keeping two copies of the same file in step over Realtime. Pure functions, safe in
 * server and client code. The files never leave each person's device; only play, pause and positions are
 * sent, on a private channel that only the night's couple can join (see the watch_room migration).
 */

/** The Realtime channel for a night's watch room. The migration's policies match this exact form. */
export function roomTopic(nightId: string) {
  return `night-room:${nightId}`;
}

/** What one person's player is doing, as broadcast to the other. */
export type RoomState = {
  /** play, pause and seek come from a person; sync answers someone joining; tick keeps playback in step. */
  kind: "play" | "pause" | "seek" | "sync" | "tick";
  playing: boolean;
  /** Seconds into the file when the message was sent. */
  position: number;
  /** The sender's clock (ms since the epoch) when it was sent. */
  at: number;
  /** Who sent it (profile ID). */
  by: string;
  /** On sync: when the sender last played, paused or jumped (their clock; 0 if never), so that after a
   * disconnection the one who acted last stays in charge. */
  actedAt?: number;
  /** On play and pause: done by the room, not a person. A pause to wait for the other screen (`wait` says
   * why), or the resume after it. Followed, but it doesn't change who's in charge. */
  auto?: boolean;
  wait?: WaitReason;
};

/** Messages older than this (after allowing for clock offset) are treated as this old: clocks can be off. */
const MAX_TRAVEL_MS = 5000;

/**
 * Where the sender's player is now, in seconds. `offsetMs` is how far the sender's clock is ahead of
 * ours (see clockOffset()). A playing state has moved on by the time the message arrives.
 */
export function targetPosition(state: RoomState, now: number, offsetMs = 0) {
  if (!state.playing) return state.position;
  const travelled = Math.min(MAX_TRAVEL_MS, Math.max(0, now - (state.at - offsetMs)));
  return state.position + travelled / 1000;
}

/**
 * A tick that took longer than this to arrive is skipped: the next one is on its way. On a poor connection
 * messages arrive late and in bunches, and following each of them made the picture jump about.
 */
export const STALE_TICK_MS = 2500;

/**
 * Whether a tick is worth following: it was sent after our own last play, pause or jump (an older one
 * crossed ours on the way and would pull us back), and it didn't take too long to arrive.
 */
export function tickUsable(state: RoomState, now: number, offsetMs: number, lastActionAt: number) {
  const sentAt = state.at - offsetMs;
  return sentAt > lastActionAt && now - sentAt <= STALE_TICK_MS;
}

/** More than this apart (seconds), on two ticks in a row, jump straight to the other player's position. */
export const SEEK_AT_S = 1.5;
/** Between this and SEEK_AT_S, run slightly fast or slow until back in step. Under it, leave well alone. */
export const NUDGE_AT_S = 0.3;
/** The most a player runs faster or slower while catching up (browsers keep the pitch; 10% was audible). */
export const MAX_NUDGE = 0.05;

/**
 * What to do about being `drift` seconds ahead (positive) or behind (negative) the other player: run at a
 * speed that closes the gap over `overSeconds` (until the next tick), play normally, or jump. A jump needs
 * the previous tick to have been far apart too (`farBefore`), so one late or odd message never causes one.
 */
export function correction(drift: number, overSeconds = 3, farBefore = false): { seek: true } | { rate: number; far: boolean } {
  const size = Math.abs(drift);
  const far = size > SEEK_AT_S;
  if (far && farBefore) return { seek: true };
  if (size > NUDGE_AT_S) return { rate: 1 - Math.max(-MAX_NUDGE, Math.min(MAX_NUDGE, drift / overSeconds)), far };
  return { rate: 1, far: false };
}

/** How long to wait before rejoining the room after the connection closed: 1 s, 2 s, 4 s… up to 30 s. */
export function rejoinDelay(attempt: number) {
  return Math.min(30_000, 1000 * 2 ** Math.max(0, attempt));
}

/**
 * How far another device's clock is ahead of ours (ms), from a ping we sent at `sentAt`, answered at
 * `theirTime`, received at `receivedAt`. Assumes the trip took as long each way. Also returns the round
 * trip, since the sample with the shortest trip is the most trustworthy.
 */
export function clockOffset(sentAt: number, theirTime: number, receivedAt: number) {
  const roundTrip = Math.max(0, receivedAt - sentAt);
  return { offset: theirTime - (sentAt + roundTrip / 2), roundTrip };
}

/**
 * An .srt subtitle file as WebVTT, which is what browsers show. A .vtt file is returned as it is.
 * SRT's comma before the milliseconds becomes a dot; cue numbers are allowed in WebVTT, so they stay.
 */
export function toWebVtt(text: string) {
  const clean = text.replace(/^﻿/, "").replace(/\r\n?/g, "\n");
  if (/^WEBVTT/.test(clean)) return clean;
  const body = clean.replace(/(\d{1,2}:\d{2}:\d{2}),(\d{3})/g, "$1.$2");
  return `WEBVTT\n\n${body.trim()}\n`;
}

/**
 * Subtitle files are often not UTF-8: Turkish ones in particular tend to be Windows-1254. Reads the bytes
 * as UTF-8 if they are valid UTF-8, else as Windows-1254 (which also covers plain Latin text).
 */
export function decodeSubtitles(bytes: ArrayBuffer) {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder("windows-1254").decode(bytes);
  }
}

/** The OpenSubtitles hash reads this many bytes from each end of the file. */
export const HASH_CHUNK = 64 * 1024;

/**
 * The OpenSubtitles hash of a video file (16 hex digits), which finds subtitles timed for that exact
 * release: the file's size plus every 64-bit little-endian word of its first and last 64 KB, modulo 2^64.
 * Only these two slices are read, in the browser; the file itself is never sent. Null for files too
 * small to hash.
 */
export function openSubtitlesHash(size: number, head: ArrayBuffer, tail: ArrayBuffer) {
  if (size < HASH_CHUNK * 2 || head.byteLength !== HASH_CHUNK || tail.byteLength !== HASH_CHUNK) return null;
  const mask = (BigInt(1) << BigInt(64)) - BigInt(1);
  let hash = BigInt(size);
  for (const chunk of [head, tail]) {
    const view = new DataView(chunk);
    for (let i = 0; i < HASH_CHUNK; i += 8) hash = (hash + view.getBigUint64(i, true)) & mask;
  }
  return hash.toString(16).padStart(16, "0");
}

/*
 * Watching together: waiting for each other, chat, reactions and comparing files. Like everything in the
 * room, none of it is stored: it travels over the room's channel and lives only on the two screens.
 */

/**
 * Why playback is held for the partner: they're in the room without a playable file yet, their player is
 * buffering, or (only to keep a hold going, never to start one) they left the room while we waited.
 */
export type WaitReason = "noFile" | "buffering" | "away";

/** What we know about the partner's player: in the room (presence), file loaded, and buffering. */
export type PartnerReadiness = { here: boolean; hasFile: boolean; buffering: boolean };

/**
 * Our side of waiting. `holding`: we paused playback because of the partner, so it's ours to resume.
 * `dismissed`: someone chose to play anyway during this wait, so don't hold again until it's over.
 */
export type Wait = { holding: boolean; dismissed: boolean };

export const NOT_WAITING: Wait = { holding: false, dismissed: false };

/** Why we'd wait for the partner right now, or null. A partner who isn't in the room starts no wait. */
export function waitReason(partner: PartnerReadiness | null, holding: boolean): WaitReason | null {
  if (!partner?.here) return holding ? "away" : null;
  if (!partner.hasFile) return "noFile";
  if (partner.buffering) return "buffering";
  return null;
}

/**
 * What to do about waiting now: hold (pause both screens) when we're playing and the partner isn't ready,
 * and resume only a hold of our own once they are. A wait someone overrode ("play anyway") isn't held
 * again until it's over. Calling this on every change is safe: it acts only on a change.
 */
export function waitStep(wait: Wait, reason: WaitReason | null, playing: boolean): { wait: Wait; action: "hold" | "resume" | null } {
  if (reason === null) return { wait: NOT_WAITING, action: wait.holding ? "resume" : null };
  if (wait.holding || wait.dismissed || !playing) return { wait, action: null };
  return { wait: { holding: true, dismissed: false }, action: "hold" };
}

/**
 * After a deliberate play, pause or seek by either of you. A pause ends our hold, so an automatic resume
 * never undoes it; a play during a hold means "play anyway". A seek changes nothing: still waiting.
 */
export function waitAfterAction(wait: Wait, kind: "play" | "pause" | "seek"): Wait {
  if (kind === "pause") return { holding: false, dismissed: wait.dismissed };
  if (kind === "play" && wait.holding) return { holding: false, dismissed: true };
  return wait;
}

/** A player stuck this long (ms) counts as buffering; shorter stalls (a seek on a fast disk) are ignored. */
export const BUFFERING_AFTER_MS = 800;
/** A buffering report is repeated while it lasts; one that hasn't been repeated for this long has expired. */
export const BUFFERING_TTL_MS = 7000;

/** Whether the partner's last buffering report still stands. */
export function partnerBuffering(report: { buffering: boolean; at: number } | null, now: number) {
  return !!report && report.buffering && now - report.at < BUFFERING_TTL_MS;
}

/**
 * Whether one more message may go out, given when the last ones were sent: at most `max` within
 * `windowMs`, and never two within `gapMs`. Returns the send times to keep for next time.
 */
export function allowSend(sent: number[], now: number, limit: { max: number; windowMs: number; gapMs?: number }) {
  const recent = sent.filter((at) => now - at < limit.windowMs);
  const last = recent.length ? recent[recent.length - 1] : -Infinity;
  if (recent.length >= limit.max || now - last < (limit.gapMs ?? 0)) return { ok: false, sent: recent };
  return { ok: true, sent: [...recent, now] };
}

/** Chat: the longest message, how many stay on screen, and how fast one person may send them. */
export const MAX_CHAT_LENGTH = 500;
export const CHAT_KEPT = 200;
export const CHAT_LIMIT = { max: 5, windowMs: 5000, gapMs: 200 };

/** A chat message as typed: trimmed, line breaks as spaces, cut to the limit. Empty means nothing to send. */
export function cleanChat(text: string) {
  return text.replace(/\s+/g, " ").trim().slice(0, MAX_CHAT_LENGTH);
}

/** Reaction stickers that float over the video on both screens. */
export const REACTIONS = ["heart", "laugh", "gasp", "cry", "fire", "popcorn"] as const;
export type Reaction = (typeof REACTIONS)[number];
/** Reactions: a few in a burst, then a pause, so tapping away can't flood the channel or the screen. */
export const REACTION_LIMIT = { max: 6, windowMs: 3000, gapMs: 150 };
/** At most this many stickers float at once on a screen; more are dropped. */
export const MAX_FLOATING = 14;

export function isReaction(value: unknown): value is Reaction {
  return typeof value === "string" && (REACTIONS as readonly string[]).includes(value);
}

/** What each person shares about their file in presence: its length (once known), name and size. */
export type FileInfo = { seconds: number | null; name: string | null; size: number | null };

export const NO_FILE: FileInfo = { seconds: null, name: null, size: null };

/** The longest file name shared (the rest is cut). */
export const MAX_FILE_NAME = 200;

/** A partner's presence entry, checked: anything malformed counts as unknown. */
export function readFileInfo(entry: unknown): FileInfo {
  const e = (entry ?? {}) as Record<string, unknown>;
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : null);
  return {
    seconds: num(e.seconds),
    name: typeof e.name === "string" && e.name ? e.name.slice(0, MAX_FILE_NAME) : null,
    size: num(e.size),
  };
}

/** Whether two presence entries say the same thing (so presence is only sent when something changed). */
export function sameFileInfo(a: FileInfo | null, b: FileInfo | null) {
  return !!a && !!b && a.seconds === b.seconds && a.name === b.name && a.size === b.size;
}

/**
 * Whether you two opened the same file: same name and size ("same"), a different size, so a different
 * file ("differentSize"), or the same size under another name, most likely a renamed copy
 * ("differentName"). Null until both are known.
 */
export function compareFiles(mine: FileInfo, theirs: FileInfo | null): "same" | "differentSize" | "differentName" | null {
  if (!theirs || mine.size === null || theirs.size === null || mine.name === null || theirs.name === null) return null;
  if (mine.size !== theirs.size) return "differentSize";
  return mine.name === theirs.name ? "same" : "differentName";
}

/** A file size as file managers show it: "1.42 GB" or "700 MB" (binary units, like Windows). */
export function formatSize(bytes: number, locale: string) {
  const gb = bytes / 1024 ** 3;
  if (gb >= 1) return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(gb)} GB`;
  const mb = bytes / 1024 ** 2;
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: mb < 10 ? 1 : 0 }).format(mb)} MB`;
}
