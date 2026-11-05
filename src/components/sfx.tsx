import type { ReactNode } from "react";

/**
 * A comic sound effect ("ZZZ…") stuck on the corner of the nearest positioned box, as decoration. Hidden
 * unless the skin draws sound effects (POW! Comic Book, globals.css), and never read out: whatever it
 * decorates already says the same in words.
 */
export function Sfx({ children }: { children: ReactNode }) {
  return (
    <span aria-hidden className="sfx">
      {children}
    </span>
  );
}
