import type { ReactNode } from "react";
import type { Reaction } from "@/lib/room-rules";

/**
 * Small inline icons drawn with a round 2-unit stroke on a 24 grid, sized to the text around them. Decorative:
 * the words next to them carry the meaning.
 */
function Glyph({
  children,
  className = "size-[1.05em]",
  strokeWidth = 2,
}: {
  children: ReactNode;
  className?: string;
  strokeWidth?: number;
}) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`inline-block shrink-0 align-[-0.15em] ${className}`}
    >
      {children}
    </svg>
  );
}

export function ArrowIcon({ className }: { className?: string }) {
  return (
    <Glyph className={className}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </Glyph>
  );
}

export function BackIcon({ className }: { className?: string }) {
  return (
    <Glyph className={className}>
      <path d="M19 12H5M11 6l-6 6 6 6" />
    </Glyph>
  );
}

export function ExternalIcon({ className }: { className?: string }) {
  return (
    <Glyph className={className}>
      <path d="M8 16 17 7M9 7h8v8" />
    </Glyph>
  );
}

export function PlusIcon({ className }: { className?: string }) {
  return (
    <Glyph className={className}>
      <path d="M12 5v14M5 12h14" />
    </Glyph>
  );
}

/** A cross, for taking something off a list. */
export function CloseIcon({ className }: { className?: string }) {
  return (
    <Glyph className={className}>
      <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />
    </Glyph>
  );
}

export function CheckIcon({ className }: { className?: string }) {
  return (
    <Glyph className={className}>
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </Glyph>
  );
}

/** The magnifying glass in the search field (a heavier stroke, as it sits alone). */
export function SearchIcon({ className }: { className?: string }) {
  return (
    <Glyph className={className} strokeWidth={2.5}>
      <circle cx="10.5" cy="10.5" r="6" />
      <path d="m15 15 5 5" />
    </Glyph>
  );
}

/** A chevron pointing down, for a disclosure that opens (turn it with CSS when open). */
export function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <Glyph className={className} strokeWidth={3}>
      <path d="m6 9 6 6 6-6" />
    </Glyph>
  );
}

/** A little calendar page with a tick, filled with the button colour, for headings. */
export function CalendarIcon({ className = "size-7" }: { className?: string }) {
  return (
    <Glyph className={className}>
      <rect x="3.5" y="5" width="17" height="15.5" rx="3" fill="var(--pop)" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
      <path d="m9 15 2 2 4-4" />
    </Glyph>
  );
}

/** A cartoon star: sunshine with an ink outline when filled, an empty outline when not. */
export function StarIcon({ filled, className = "size-[1em]" }: { filled: boolean; className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className={`inline-block shrink-0 overflow-visible align-[-0.12em] ${className}`}>
      <path
        d="m12 3.5 2.6 5.5 6 .7-4.5 4.1 1.2 5.9L12 16.8l-5.3 2.9 1.2-5.9-4.5-4.1 6-.7z"
        fill={filled ? "var(--pop)" : "none"}
        stroke="var(--outline)"
        strokeOpacity={filled ? 1 : 0.45}
        strokeWidth={2}
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** The faces' outline: shared by the laughing, gasping and crying stickers. */
const FACE = <circle cx="16" cy="16" r="13" />;

/** Each reaction sticker's outer shapes (filled and outlined) and the drawing on top of them. */
const STICKERS: Record<Reaction, { outer: ReactNode; fill: string; inner: ReactNode }> = {
  heart: {
    fill: "var(--blush)",
    outer: <path d="M16 27.5C6.5 21 3 15 3 10.5 3 6.4 6 3.5 9.6 3.5c2.8 0 4.9 1.7 6.4 4.3 1.5-2.6 3.6-4.3 6.4-4.3C26 3.5 29 6.4 29 10.5c0 4.5-3.5 10.5-13 17Z" />,
    inner: <path d="M7.6 10.2c0-1.8 1.2-3.2 3-3.4" stroke="var(--p-surface)" strokeWidth={2} fill="none" />,
  },
  laugh: {
    fill: "var(--pop)",
    outer: FACE,
    inner: (
      <>
        <path d="M8.5 13.5Q11 9.8 13.5 13.5M18.5 13.5Q21 9.8 23.5 13.5" stroke="var(--p-ink)" strokeWidth={2} fill="none" />
        <path d="M8.8 17.8h14.4c0 4.6-3.3 7.7-7.2 7.7s-7.2-3.1-7.2-7.7Z" fill="var(--p-ink)" />
        <path d="M12.4 23.4c1.6-1.5 5.6-1.5 7.2 0-1 1.4-6.2 1.4-7.2 0Z" fill="var(--blush)" />
      </>
    ),
  },
  gasp: {
    fill: "var(--pop)",
    outer: FACE,
    inner: (
      <>
        <path d="M8.5 9.2Q11 7 13.6 8.6M18.4 8.6Q21 7 23.5 9.2" stroke="var(--p-ink)" strokeWidth={1.8} fill="none" />
        <circle cx="11" cy="13.2" r="1.9" fill="var(--p-ink)" />
        <circle cx="21" cy="13.2" r="1.9" fill="var(--p-ink)" />
        <ellipse cx="16" cy="21.6" rx="3.1" ry="4" fill="var(--p-ink)" />
      </>
    ),
  },
  cry: {
    fill: "var(--pop)",
    outer: FACE,
    inner: (
      <>
        <path d="M8.5 12.5Q11 14.8 13.5 12.5M18.5 12.5Q21 14.8 23.5 12.5M11.5 23.2Q16 19 20.5 23.2" stroke="var(--p-ink)" strokeWidth={2} fill="none" />
        <path d="M10.6 15.6c-1.6 3-2.6 4.6-2.6 6.2a2.6 2.6 0 0 0 5.2 0c0-1.6-1-3.2-2.6-6.2Z" fill="var(--partner-soft)" stroke="var(--outline)" strokeWidth={1.5} />
      </>
    ),
  },
  fire: {
    fill: "var(--blush)",
    outer: <path d="M16 3c2 5 8 7.2 9 14.2.9 6.6-3.8 11.8-9 11.8s-9.8-4-9-10.6c.4-3.4 2.4-5.5 4-7 0 2.6 1 4.1 2.5 4.6C13 11 14 6.6 16 3Z" />,
    inner: <path d="M16 14.2c1.4 3 4.5 4.3 4.5 8.3 0 3-2 4.6-4.5 4.6s-4.5-1.6-4.5-4.6c0-2.5 2-4 2.5-5.5 1 1.5 1.6-.3 2-2.8Z" fill="var(--pop)" stroke="var(--outline)" strokeWidth={1.5} />,
  },
  popcorn: {
    fill: "var(--p-surface)",
    outer: (
      <>
        <circle cx="9.6" cy="12.2" r="3.5" />
        <circle cx="14.2" cy="9.4" r="3.8" />
        <circle cx="19.2" cy="10" r="3.6" />
        <circle cx="23" cy="12.6" r="3.3" />
        <path d="M6.8 14h18.4l-2.7 15H9.5Z" />
      </>
    ),
    inner: (
      <>
        <circle cx="16.6" cy="12.6" r="2.6" fill="var(--pop)" stroke="var(--outline)" strokeWidth={1.5} />
        <path d="M11 14.4h3.4l.4 14.2h-2.8ZM17.4 14.4h3.4l-1.4 14.2h-2.8Z" fill="var(--blush)" />
        <path d="M6.8 14h18.4l-2.7 15H9.5Z" fill="none" stroke="var(--outline)" strokeWidth={1.8} />
      </>
    ),
  },
};

/**
 * A reaction sticker (heart, laugh, gasp, cry, fire, popcorn), drawn in the palette's colours with an ink
 * line. `edge` adds a paper die-cut edge, for stickers floating over a video. Decorative.
 */
export function ReactionSticker({ kind, edge = false, className = "size-7" }: { kind: Reaction; edge?: boolean; className?: string }) {
  const s = STICKERS[kind];
  return (
    <svg aria-hidden viewBox="0 0 32 32" strokeLinecap="round" strokeLinejoin="round" className={`inline-block shrink-0 overflow-visible ${className}`}>
      {edge && (
        <g fill="var(--p-surface)" stroke="var(--p-surface)" strokeWidth={5}>
          {s.outer}
        </g>
      )}
      <g fill={s.fill} stroke="var(--outline)" strokeWidth={1.8}>
        {s.outer}
      </g>
      {s.inner}
    </svg>
  );
}

/** Four corners pointing out (enter full screen) or in (leave it). */
export function FullscreenIcon({ exit = false, className }: { exit?: boolean; className?: string }) {
  return (
    <Glyph className={className} strokeWidth={2.5}>
      {exit ? <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" /> : <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />}
    </Glyph>
  );
}

/** A speech bubble, for the watch room's chat. */
export function ChatIcon({ className }: { className?: string }) {
  return (
    <Glyph className={className} strokeWidth={2.25}>
      <path d="M5 5.5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-7l-4.5 3.5V17.5H5a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2Z" />
    </Glyph>
  );
}

/** An arrow down into a tray: save a file. */
export function DownloadIcon({ className }: { className?: string }) {
  return (
    <Glyph className={className} strokeWidth={2.5}>
      <path d="M12 4v11M7 10.5l5 5 5-5M5 19.5h14" />
    </Glyph>
  );
}
