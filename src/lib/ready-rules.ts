/** Ready-check rules for watch nights. Pure functions, safe in server and client code. Mirrors the checks on ready_checks. */

import type { NightMethod } from "./night-rules";

export const MAX_FILE_LABEL_LENGTH = 100;
/** Longest file length that can be entered: a day. */
export const MAX_FILE_SECONDS = 24 * 60 * 60;
/** Lengths typed from two players can be a second or two apart and still be the same version. */
export const SAME_LENGTH_TOLERANCE_S = 3;

/** One person's ready check for a night. */
export type ReadyCheck = {
  profile_id: string;
  /** When they said they were ready, or null while they aren't. */
  ready_at: string | null;
  file_label: string;
  file_seconds: number | null;
};

/** Teleparty streams the same service on both sides, so there's no file to compare. */
export function usesOwnFiles(method: NightMethod | null) {
  return method !== "teleparty";
}

/** A trimmed version label, or null if it's too long or looks like a link (only a description is stored). */
export function cleanFileLabel(value: unknown): string | null {
  const label = typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
  if (label.length > MAX_FILE_LABEL_LENGTH || /(:\/\/|magnet:|www\.)/i.test(label)) return null;
  return label;
}

/**
 * A length as a player shows it, in seconds: "1:52:03" (h:mm:ss) or "112" (minutes). Two parts are h:mm
 * for a film ("2:16") and m:ss for an episode ("45:12"): nothing watched together runs 10 hours.
 * "" is no length (null); anything else that doesn't parse is undefined.
 */
export function parseLength(value: unknown): number | null | undefined {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) return null;
  const parts = text.split(":");
  if (parts.length > 3 || !/^\d{1,3}$/.test(parts[0]) || parts.slice(1).some((p) => !/^[0-5]\d$/.test(p))) {
    return undefined;
  }
  const [a, b, c] = parts.map(Number);
  const seconds =
    parts.length === 1 ? a * 60 : parts.length === 3 ? a * 3600 + b * 60 + c : a < 10 ? a * 3600 + b * 60 : a * 60 + b;
  return seconds > 0 && seconds <= MAX_FILE_SECONDS ? seconds : undefined;
}

/** "1:52:03", or "2:13" under an hour. */
export function formatLength(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

/** Whether both lengths are known and the same (within a few seconds), or how far apart they are. */
export function compareLengths(a: number | null, b: number | null) {
  if (a === null || b === null) return null;
  const difference = Math.abs(a - b);
  return { same: difference <= SAME_LENGTH_TOLERANCE_S, difference };
}

/** True when both people are ready. */
export function bothReady(checks: ReadyCheck[], me: string, partner: string | null) {
  const ready = (id: string | null) => checks.some((c) => c.profile_id === id && c.ready_at !== null);
  return partner !== null && ready(me) && ready(partner);
}
