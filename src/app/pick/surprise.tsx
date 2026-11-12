import Image from "next/image";
import type { CSSProperties } from "react";
import { Sfx } from "@/components/sfx";
import { tmdbImage } from "@/lib/watch";
import { StripSurprise } from "./strip-surprise";

/** Where each shuffled card sits on the pick's poster (degrees), and which way it flies off. */
const SPOTS = [
  { r: -6, dir: 1 },
  { r: 5, dir: -1 },
  { r: -3, dir: 1 },
  { r: 7, dir: -1 },
];

/** How many other posters shuffle past before the pick lands. */
export const SURPRISE_CARDS = SPOTS.length;

/**
 * "Surprise us": a little pile of other posters on top of the pick's poster that spins, then flicks off
 * card by card until the pick itself lands (globals.css, Sprint 16). The cards are the poster deck's
 * `.deck-card`s, so each skin draws them its own way (and POW! shouts "Shuffle!"). Decorative; with
 * reduced motion it isn't shown at all. Put it inside the poster's positioned frame, and give the article
 * `data-surprise` with `--n` (the number of cards).
 */
export function Surprise({ posters, sfx }: { posters: string[]; sfx: string }) {
  return (
    <span aria-hidden className="surprise-deck">
      {posters.slice(0, SPOTS.length).map((path, k) => (
        <span
          key={path}
          className="deck-card"
          style={{ "--x": 0, "--y": 0, "--r": SPOTS[k].r, "--z": SPOTS.length - k, "--k": k, "--dir": SPOTS[k].dir } as CSSProperties}
        >
          <Image src={tmdbImage(path, "w185")} alt="" width={200} height={300} unoptimized loading="eager" draggable={false} />
        </span>
      ))}
      <Sfx>{sfx}</Sfx>
      <StripSurprise />
    </span>
  );
}

/** Two cards fanned out with a heart on the top one: swiping together. */
export function ShuffleIcon({ className = "size-12" }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 48 48" className={`shrink-0 overflow-visible ${className}`}>
      <g transform="rotate(-14 20 30)">
        <rect x="8" y="8" width="22" height="32" rx="4" fill="var(--outline)" transform="translate(3 3)" />
        <rect x="8" y="8" width="22" height="32" rx="4" fill="var(--partner)" stroke="var(--outline)" strokeWidth={3} />
      </g>
      <g transform="rotate(10 28 30)">
        <rect x="18" y="8" width="22" height="32" rx="4" fill="var(--outline)" transform="translate(3 3)" />
        <rect x="18" y="8" width="22" height="32" rx="4" fill="var(--me)" stroke="var(--outline)" strokeWidth={3} />
        <path
          d="M29 30.5s-5.5-3.3-5.5-7.3a3.1 3.1 0 0 1 5.5-1.9 3.1 3.1 0 0 1 5.5 1.9c0 4-5.5 7.3-5.5 7.3z"
          fill="var(--stamp)"
          stroke="var(--outline)"
          strokeWidth={2.5}
          strokeLinejoin="round"
        />
      </g>
    </svg>
  );
}
