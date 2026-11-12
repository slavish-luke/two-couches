import type { CSSProperties, ReactNode } from "react";
import type { StickerId } from "@/lib/taste-rules";

/*
 * Milestone stickers: drawn SVG badges in the palette's tokens. Each one carries three outlines and the skin
 * shows one (globals.css, "Sprint 17"): a scalloped rosette with a hard ink shadow (Saturday Morning; with
 * Scrapbook's white die-cut edge and soft drop), a jagged BOOM! burst (POW!), a flat candy disc (Candy Shop).
 * The middle is paper with an ink picture. Unearned ones are drawn faint by `[data-earned="false"]`.
 */

/** A circle of `points` points alternating between radius `outer` and `inner`, as a path around (60, 60). */
function ring(points: number, outer: number, inner: number, wobble: number[] = []) {
  const step = Math.PI / points;
  const coords = Array.from({ length: points * 2 }, (_, i) => {
    const r = (i % 2 ? inner : outer) + (wobble[i % wobble.length] ?? 0);
    const a = i * step - Math.PI / 2;
    return `${(60 + r * Math.cos(a)).toFixed(1)} ${(60 + r * Math.sin(a)).toFixed(1)}`;
  });
  return `M${coords.join("L")}Z`;
}

const ROSETTE = ring(18, 56, 50);
const BURST = ring(11, 58, 40, [0, 2, -4, 0, 3, -2, -3, 1, 4, 0, -1]);

/** Each sticker's colour (a palette fill token). */
const FILL: Record<StickerId, string> = {
  firstNight: "var(--me)",
  titles10: "var(--pop)",
  titles25: "var(--partner)",
  titles50: "var(--me)",
  titles100: "var(--stamp)",
  streak: "var(--accent)",
  bothFive: "var(--stamp)",
  spotOn: "var(--partner)",
  oneYear: "var(--pop)",
};

const INK = { fill: "none", stroke: "var(--p-ink)", strokeWidth: 3.5, strokeLinecap: "round", strokeLinejoin: "round" } as const;

/** The ink picture in the middle of each sticker. */
function picture(id: StickerId): ReactNode {
  switch (id) {
    case "firstNight":
      // A little couch.
      return (
        <g {...INK}>
          <path d="M41 66v-9a5 5 0 0 1 10 0v4h18v-4a5 5 0 0 1 10 0v9" />
          <path d="M46 61h28M41 66h38v6H41zM45 72v4M75 72v4" />
          <path d="M51 61v-6a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v6" />
        </g>
      );
    case "streak":
      // A flame.
      return (
        <g {...INK}>
          <path d="M60 41c2 8 12 12 12 24a12 12 0 0 1-24 0c0-6 3-9 5-12 1 4 3 6 5 6-2-6 0-13 2-18z" />
          <path d="M60 77a5 5 0 0 1-5-5c0-3 3-5 5-8 2 3 5 5 5 8a5 5 0 0 1-5 5z" />
        </g>
      );
    case "bothFive":
      // Two stars, overlapping like the two of you.
      return (
        <g {...INK} strokeWidth={3}>
          <path d="m50 44 3.5 7.3 8 1.1-5.8 5.6 1.4 7.9-7.1-3.8-7.1 3.8 1.4-7.9-5.8-5.6 8-1.1z" fill="var(--pop)" />
          <path d="m70 54 3.5 7.3 8 1.1-5.8 5.6 1.4 7.9-7.1-3.8-7.1 3.8 1.4-7.9-5.8-5.6 8-1.1z" fill="var(--pop)" />
        </g>
      );
    case "spotOn":
      // A target with a dart in the middle.
      return (
        <g {...INK}>
          <circle cx="58" cy="62" r="15" />
          <circle cx="58" cy="62" r="7" />
          <circle cx="58" cy="62" r="1.5" fill="var(--p-ink)" />
          <path d="M58 62l17-17M70 45h5v5" />
        </g>
      );
    case "oneYear":
      // A cake with one candle.
      return (
        <g {...INK}>
          <path d="M43 66h34v12H43zM43 66c0-4 4-6 8-6h18c4 0 8 2 8 6" />
          <path d="M43 71c4 3 8-3 11 0s8 3 11 0 8-3 12 0" strokeWidth={3} />
          <path d="M60 60v-9" />
          <path d="M60 41c2 3 3 4 3 6a3 3 0 0 1-6 0c0-2 1-3 3-6z" fill="var(--pop)" strokeWidth={2.5} />
        </g>
      );
    default: {
      // The title counts: the number in the skin's lettering.
      const n = id.replace("titles", "");
      return (
        <text
          x="60"
          y="61"
          textAnchor="middle"
          dominantBaseline="central"
          fill="var(--p-ink)"
          style={{ fontFamily: "var(--font-skin-display)", fontSize: n.length > 2 ? 25 : 32 }}
        >
          {n}
        </text>
      );
    }
  }
}

export function StickerArt({ id, className = "", style }: { id: StickerId; className?: string; style?: CSSProperties }) {
  const fill = FILL[id];
  const edge = { fill, stroke: "var(--outline)", strokeWidth: 4, strokeLinejoin: "round" } as const;
  return (
    <svg aria-hidden data-sticker viewBox="0 0 120 120" className={`overflow-visible ${className}`} style={style}>
      <path data-shape="rosette" d={ROSETTE} {...edge} />
      <path data-shape="burst" d={BURST} {...edge} />
      <circle data-shape="disc" cx="60" cy="60" r="54" {...edge} />
      <circle cx="60" cy="60" r="33" fill="var(--p-surface)" stroke="var(--p-ink)" strokeWidth={3} />
      {picture(id)}
    </svg>
  );
}
