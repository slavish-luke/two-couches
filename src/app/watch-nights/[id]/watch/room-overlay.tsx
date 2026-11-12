"use client";

import type { CSSProperties } from "react";
import { ReactionSticker } from "@/components/icons";
import type { Reaction } from "@/lib/room-rules";

/** A reaction floating over the video: whose it is, where it starts across the screen, and its sway. */
export type Burst = { id: number; kind: Reaction; mine: boolean; x: number; sway: number };

/**
 * What floats over the video (or the empty player), inside the element that goes full screen, so it shows
 * there too: short messages about your partner's actions in the top corner, reaction stickers drifting
 * up, and "Waiting for…" in the middle while one of you holds playback for the other.
 */
export function RoomOverlay({
  toasts,
  bursts,
  onBurstDone,
  waiting,
}: {
  toasts: { id: number; text: string }[];
  bursts: Burst[];
  onBurstDone: (id: number) => void;
  waiting: { text: string; action?: { label: string; onClick: () => void } } | null;
}) {
  return (
    <>
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]">
        {bursts.map((b) => (
          <span
            key={b.id}
            data-reaction
            className="absolute bottom-[10%]"
            style={{ left: `${b.x}%`, "--sway": `${b.sway}px` } as CSSProperties}
            onAnimationEnd={() => onBurstDone(b.id)}
          >
            <ReactionSticker kind={b.kind} edge className="size-[clamp(2.75rem,9cqi,5.5rem)]" />
            <span className={`absolute -bottom-1 left-1/2 size-3 -translate-x-1/2 rounded-full border-2 border-outline ${b.mine ? "bg-me" : "bg-partner"}`} />
          </span>
        ))}
      </div>

      <div role="status" aria-live="polite" className="pointer-events-none absolute left-2.5 top-2.5 grid max-w-[min(28rem,calc(100%-1.25rem))] justify-items-start gap-1.5 sm:left-3.5 sm:top-3.5">
        {toasts.map((t) => (
          <p
            key={t.id}
            data-room-toast
            className="paper line-clamp-2 rounded-control border-[2.5px] border-outline px-2.5 py-1 text-sm font-bold break-words shadow-[var(--lift-sm)_var(--lift-sm)_0_var(--outline)]"
          >
            {t.text}
          </p>
        ))}
      </div>

      {waiting && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center p-3">
          <div
            data-room-waiting
            role="status"
            className="paper pointer-events-auto grid max-w-[min(24rem,85%)] justify-items-center gap-2 rounded-panel border-[3px] border-outline px-4 py-3 text-center shadow-[var(--lift-sm)_var(--lift-sm)_0_var(--outline)] @max-md:gap-1 @max-md:px-3 @max-md:py-2 @max-md:text-sm"
          >
            <p className="font-bold text-balance">{waiting.text}</p>
            {waiting.action && (
              <button type="button" className="btn-quiet py-1 text-sm @max-md:py-0.5" onClick={waiting.action.onClick}>
                {waiting.action.label}
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
