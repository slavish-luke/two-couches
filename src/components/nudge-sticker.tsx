import type { NudgeKind } from "@/lib/together-rules";
import { ReactionSticker } from "./icons";

/**
 * A thinking-of-you nudge's sticker: the heart, an alarm clock for "starting soon", the popcorn for "ready
 * when you are". Drawn like the room's reaction stickers, in the palette's colours. Decorative.
 */
export function NudgeSticker({ kind, className = "size-7" }: { kind: NudgeKind; className?: string }) {
  if (kind === "heart") return <ReactionSticker kind="heart" className={className} />;
  if (kind === "ready") return <ReactionSticker kind="popcorn" className={className} />;
  return (
    <svg aria-hidden viewBox="0 0 32 32" strokeLinecap="round" strokeLinejoin="round" className={`inline-block shrink-0 overflow-visible ${className}`}>
      <g fill="var(--pop)" stroke="var(--outline)" strokeWidth={1.8}>
        <path d="M4.2 9.6a5 5 0 0 1 6.6-5.8ZM27.8 9.6a5 5 0 0 0-6.6-5.8Z" />
        <circle cx="16" cy="17.5" r="11" />
      </g>
      <circle cx="16" cy="17.5" r="8" fill="var(--p-surface)" stroke="none" />
      <path d="M16 11.6v6l4 2.6" fill="none" stroke="var(--p-ink)" strokeWidth={2.2} />
      <path d="M8.5 28.4l2-2.6M23.5 28.4l-2-2.6" fill="none" stroke="var(--outline)" strokeWidth={2} />
    </svg>
  );
}
