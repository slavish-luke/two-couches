import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./supabase/database.types";

/**
 * The watch room's sync log (2026-11-15): what this screen's sync did and why, so a night where the picture
 * skipped can be read afterwards from both sides. Realtime doesn't log broadcast messages, so without this
 * the server logs only show who connected when.
 *
 * Entries are kept on this device (localStorage, per night, so a reload doesn't lose them; "Download sync
 * log" saves them as a file) and sent to `room_logs` every SEND_MS as one row, straight from the browser
 * (RLS applies). Positions, timings, the file's name and size: never chat text. Logging must never break
 * the room, so everything here swallows its own errors.
 */
export type LogEntry = { t: number; k: string } & Record<string, unknown>;

/** Entries kept on this device per night (about 100 bytes each). */
const KEPT = 8000;
/** How often new entries go to the database, and how often they're saved on this device. */
export const SEND_MS = 30_000;
const SAVE_MS = 5_000;
/** One row stays well under the table's 256 KB check. */
const PART_BYTES = 180_000;
/** Entries waiting to be sent when the database can't be reached; older ones are dropped (still kept here). */
const UNSENT_MAX = 6000;

const storageKey = (nightId: string) => `room-log:${nightId}`;

/** A number rounded for the log: seconds to the hundredth, rates to the thousandth. */
export function r(n: number | null | undefined, places = 2) {
  if (n === null || n === undefined || !Number.isFinite(n)) return null;
  const f = 10 ** places;
  return Math.round(n * f) / f;
}

/** How many seconds past the playhead the player has ready (0 when the playhead is outside what's loaded). */
export function bufferedAhead(v: HTMLMediaElement) {
  const ranges = v.buffered;
  for (let i = 0; i < ranges.length; i += 1) {
    if (ranges.start(i) <= v.currentTime + 0.05 && ranges.end(i) >= v.currentTime) return r(ranges.end(i) - v.currentTime, 1);
  }
  return 0;
}

export class RoomLog {
  readonly session = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  private entries: LogEntry[] = [];
  private unsent: LogEntry[] = [];
  private part = 0;
  private sending = false;
  private restored = false;
  private saveTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(private readonly nightId: string) {}

  /** Earlier visits' entries for this night, from this device (call once, in the browser). */
  restore() {
    if (this.restored) return;
    this.restored = true;
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey(this.nightId)) ?? "[]") as unknown;
      if (Array.isArray(saved)) this.entries = [...(saved as LogEntry[]), ...this.entries].slice(-KEPT);
    } catch {
      // Private window, blocked storage or a damaged copy: start afresh.
    }
  }

  add(k: string, data?: Record<string, unknown>) {
    const entry: LogEntry = { t: Date.now(), k, ...data };
    this.entries.push(entry);
    if (this.entries.length > KEPT) this.entries.splice(0, this.entries.length - KEPT);
    this.unsent.push(entry);
    if (this.unsent.length > UNSENT_MAX) this.unsent.splice(0, this.unsent.length - UNSENT_MAX);
    this.saveTimer ??= setTimeout(() => this.save(), SAVE_MS);
  }

  save() {
    clearTimeout(this.saveTimer);
    this.saveTimer = undefined;
    try {
      localStorage.setItem(storageKey(this.nightId), JSON.stringify(this.entries));
    } catch {
      // Full or blocked: the database copy still goes out.
    }
  }

  /** Send what's new as one or more rows. Failed parts go back to be sent next time. */
  async send(supabase: SupabaseClient<Database>, coupleId: string) {
    if (this.sending || this.unsent.length === 0) return;
    this.sending = true;
    const batch = this.unsent;
    this.unsent = [];
    let sent = 0;
    try {
      for (const chunk of chunks(batch)) {
        const { error } = await supabase.from("room_logs").insert({
          watch_night_id: this.nightId,
          couple_id: coupleId,
          session: this.session,
          part: this.part,
          entries: chunk as never,
        });
        if (error) throw error;
        this.part += 1;
        sent += chunk.length;
      }
    } catch {
      // Whatever didn't go out goes first next time; parts that did aren't sent again.
      this.unsent = [...batch.slice(sent), ...this.unsent].slice(-UNSENT_MAX);
    } finally {
      this.sending = false;
    }
  }

  /** Everything kept on this device for this night, as a text file to save. */
  download(fileName: string, header: Record<string, unknown>) {
    this.save();
    const lines = [
      `# Two Couches watch room sync log`,
      `# ${JSON.stringify({ ...header, session: this.session, savedAt: new Date().toISOString() })}`,
      ...this.entries.map(({ t, k, ...rest }) => `${new Date(t).toISOString()} ${k} ${JSON.stringify(rest)}`),
    ];
    const url = URL.createObjectURL(new Blob([lines.join("\n") + "\n"], { type: "text/plain" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }
}

/** Entries split so each row stays under PART_BYTES of JSON. */
function chunks(entries: LogEntry[]) {
  const out: LogEntry[][] = [];
  let current: LogEntry[] = [];
  let bytes = 2;
  for (const entry of entries) {
    const size = JSON.stringify(entry).length + 1;
    if (current.length > 0 && bytes + size > PART_BYTES) {
      out.push(current);
      current = [];
      bytes = 2;
    }
    current.push(entry);
    bytes += size;
  }
  if (current.length > 0) out.push(current);
  return out;
}
