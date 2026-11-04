import type { ReactNode } from "react";

/**
 * Small inline icons drawn with a round 2-unit stroke on a 24 grid, sized to the text around them. Decorative:
 * the words next to them carry the meaning.
 */
function Glyph({ children, className = "size-[1.05em]" }: { children: ReactNode; className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
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

export function CheckIcon({ className }: { className?: string }) {
  return (
    <Glyph className={className}>
      <path d="m5 12.5 4.5 4.5L19 7.5" />
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
