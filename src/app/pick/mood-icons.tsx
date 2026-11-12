import type { ReactNode } from "react";
import type { Mood } from "@/lib/pick-rules";

/**
 * Drawn icons for the five moods (24px box, 2.25 stroke, round caps and joins, paper fills), in the ink
 * of whatever they sit on.
 */
export function MoodIcon({ mood, className = "size-5" }: { mood: Mood; className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.25}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`inline-block shrink-0 ${className}`}
    >
      {ICONS[mood]}
    </svg>
  );
}

const ICONS: Record<Mood, ReactNode> = {
  // A mug with steam.
  cosy: (
    <>
      <path d="M4.5 10h11v5.5a4 4 0 0 1-4 4h-3a4 4 0 0 1-4-4z" fill="var(--surface)" />
      <path d="M15.5 11.5h1.5a2.5 2.5 0 0 1 0 5h-1.6" />
      <path d="M8 3.5c-1 1 1 2 0 3.3M11.5 3.5c-1 1 1 2 0 3.3" />
    </>
  ),
  // A lightning bolt.
  gripping: <path d="M13.5 2.5 5 13.5h6l-1.5 8 8.5-11h-6z" fill="var(--surface)" />,
  // A grin with squeezed-shut eyes.
  funny: (
    <>
      <circle cx="12" cy="12" r="9" fill="var(--surface)" />
      <path d="m7.5 9 2 1-2 1M16.5 9l-2 1 2 1" />
      <path d="M7.5 14h9a4.5 4.5 0 0 1-9 0z" fill="currentColor" />
    </>
  ),
  // A balloon on a string.
  light: (
    <>
      <path d="M12 3a5.5 5.5 0 0 1 5.5 5.5c0 3.6-3 6.5-5.5 7.5-2.5-1-5.5-3.9-5.5-7.5A5.5 5.5 0 0 1 12 3z" fill="var(--surface)" />
      <path d="m11 16.6-.6 1.2h3.2l-.6-1.2M12 18c-1.2 1.4 1.2 2.2 0 3.5" />
    </>
  ),
  // A crescent moon and a small z.
  tired: (
    <>
      <path d="M14 4.5a7.5 7.5 0 1 0 5.5 12.6A6 6 0 0 1 14 4.5z" fill="var(--surface)" />
      <path d="M16 3.5h3.5L16 7.5h3.5" strokeWidth={1.75} />
    </>
  ),
};
