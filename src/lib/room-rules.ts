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

/** More than this apart (seconds), jump straight to the other player's position. */
export const SEEK_AT_S = 1;
/** Between this and SEEK_AT_S, run slightly fast or slow until back in step. */
export const NUDGE_AT_S = 0.2;
/** The most a player runs faster or slower while catching up (browsers keep the pitch). */
export const MAX_NUDGE = 0.1;

/**
 * What to do about being `drift` seconds ahead (positive) or behind (negative) the other player:
 * jump, or run at a speed that closes the gap over `overSeconds` (until the next tick), or play normally.
 */
export function correction(drift: number, overSeconds = 3): { seek: true } | { rate: number } {
  const size = Math.abs(drift);
  if (size > SEEK_AT_S) return { seek: true };
  if (size > NUDGE_AT_S) return { rate: 1 - Math.max(-MAX_NUDGE, Math.min(MAX_NUDGE, drift / overSeconds)) };
  return { rate: 1 };
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
