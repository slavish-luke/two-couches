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
  /** The file's name and size (bytes), when it was chosen in the ready check rather than typed (Sprint 23). */
  file_name: string | null;
  file_size: number | null;
};

/** Teleparty streams the same service on both sides, so there's no file to compare. */
export function usesOwnFiles(method: NightMethod | null) {
  return method !== "teleparty";
}

/** What counts as a link in a label or file name. The ready_checks table refuses the same. */
const LINK = /(:\/\/|magnet:|www\.)/i;

/** A trimmed version label, or null if it's too long or looks like a link (only a description is stored). */
export function cleanFileLabel(value: unknown): string | null {
  const label = typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
  if (label.length > MAX_FILE_LABEL_LENGTH || LINK.test(label)) return null;
  return label;
}

/** The longest file name kept with a ready check (the table's limit too). */
export const MAX_FILE_NAME_LENGTH = 100;
/** The biggest file size kept: 1 TiB (the table's limit too). */
export const MAX_FILE_SIZE = 2 ** 40;

/**
 * Takes out anything link-like ("www.", "://", "magnet:"), again until none is left, since taking one out
 * can join the text around it into another. Release names often carry a site's "www.", which isn't a link
 * here but would be refused.
 */
function unlink(text: string) {
  let out = text;
  while (LINK.test(out)) out = out.replace(new RegExp(LINK.source, "gi"), " ");
  return out;
}

/**
 * A chosen file's name as the ready check keeps it, to compare with your partner's: link-like parts taken
 * out, spaces tidied, cut to MAX_FILE_NAME_LENGTH. Both screens clean names the same way, so the same file
 * gives the same name. Null when nothing is left.
 */
export function cleanFileName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const name = unlink(value).replace(/\s+/g, " ").trim().slice(0, MAX_FILE_NAME_LENGTH).trim();
  return name && !LINK.test(name) ? name : null;
}

/** A file size in bytes, or null if it isn't a sensible one. */
export function cleanFileSize(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 1 && value <= MAX_FILE_SIZE ? value : null;
}

/**
 * A version label made from a file's name, to start from: "Film.2020.1080p.BluRay.x264.mkv" becomes
 * "Film 2020 1080p BluRay x264". Without the extension, dots and underscores as spaces, nothing link-like,
 * cut to the label's limit, so cleanFileLabel() always accepts it.
 */
export function labelFromFileName(name: string): string {
  const base = name.replace(/\.[a-z0-9]{2,4}$/i, "");
  const label = unlink(base).replace(/[._]+/g, " ").replace(/\s+/g, " ").trim();
  return label.slice(0, MAX_FILE_LABEL_LENGTH).trim();
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

/**
 * A length to put in the length field, which parseLength() reads back as the same: formatLength(), except
 * under 10 minutes, where "1:05" would read as an hour and five minutes, so it's "0:01:05".
 */
export function lengthForInput(seconds: number) {
  return seconds < 600 ? `0:${formatLength(seconds).padStart(5, "0")}` : formatLength(seconds);
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
