import type { CSSProperties, ReactNode } from "react";

/** A spiky starburst outline around (cx, cy): `points` spikes between radius r1 (tips) and r2 (dips). */
export function burstPath(points: number, r1: number, r2: number, cx: number, cy: number) {
  let d = "";
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 ? r2 : r1;
    const a = (Math.PI * i) / points - Math.PI / 2;
    d += `${i ? "L" : "M"}${(cx + r * Math.cos(a)).toFixed(1)} ${(cy + r * Math.sin(a)).toFixed(1)}`;
  }
  return `${d}Z`;
}

const BURST = burstPath(12, 48, 34, 50, 50);

/**
 * The bubblegum starburst that pops onto anything you can both watch, with its word in the middle. It pops
 * in (scale from nothing, overshoot, settle at a tilt) staggered by `index`; reduced motion shows it still.
 * Size it with a width class; the word scales with `textClass`.
 */
export function Burst({
  children,
  index = 0,
  className = "size-20",
  textClass = "text-[15px]",
  title,
}: {
  children: ReactNode;
  index?: number;
  className?: string;
  textClass?: string;
  title?: string;
}) {
  return (
    <span
      title={title}
      style={{ "--i": index, "--r": "-8deg", rotate: "var(--r)" } as CSSProperties}
      className={`burst relative inline-grid shrink-0 place-items-center ${className}`}
    >
      <svg aria-hidden viewBox="0 0 100 100" className="absolute inset-0 size-full overflow-visible">
        <path d={BURST} fill="var(--stamp)" stroke="var(--outline)" strokeWidth={4} strokeLinejoin="round" />
      </svg>
      <span
        className={`display relative max-w-[78%] text-center leading-[0.9] ${textClass}`}
        style={{ textShadow: "none", WebkitTextStroke: "1.5px var(--outline)" }}
      >
        {children}
      </span>
    </span>
  );
}
