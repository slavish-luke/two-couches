/**
 * Live changes to the couple's rows, passed around the page (Sprint 27). ListSync and useCoupleChanges hear
 * them from Realtime and announce each insert and update here, so anything that wants to react to what your
 * partner just did (the peek: src/components/partner-peek.tsx) can listen without a channel of its own.
 * Browser only.
 */
export type CoupleChange = {
  table: string;
  eventType: "INSERT" | "UPDATE";
  commit_timestamp: string;
  /** The row as it is now (Realtime sends only its key as `old`). */
  new: Record<string, unknown>;
};

const EVENT = "couple-change";

/** Passes a Realtime payload on to listeners on this page. Deletes aren't passed: they carry only a key. */
export function announceChange(payload: { table: string; eventType: string; commit_timestamp: string; new: unknown }) {
  if (payload.eventType !== "INSERT" && payload.eventType !== "UPDATE") return;
  const change: CoupleChange = {
    table: payload.table,
    eventType: payload.eventType,
    commit_timestamp: payload.commit_timestamp,
    new: (payload.new ?? {}) as Record<string, unknown>,
  };
  window.dispatchEvent(new CustomEvent<CoupleChange>(EVENT, { detail: change }));
}

export function onCoupleChange(fn: (change: CoupleChange) => void): () => void {
  const handler = (event: Event) => fn((event as CustomEvent<CoupleChange>).detail);
  window.addEventListener(EVENT, handler);
  return () => window.removeEventListener(EVENT, handler);
}
