import Link from "next/link";
import { ArrowIcon } from "@/components/icons";
import { getI18n } from "@/lib/i18n/server";
import { SURPRISE_MINUTES } from "@/lib/pick-rules";
import { ShuffleIcon } from "./surprise";

/**
 * The home page's way into /pick, with two shortcuts under it: "Surprise us" (straight to a pick, which
 * shuffles in) and "Swipe together" (the swipe deck). The whole card opens Pick; the shortcuts sit above
 * its link. Reads the viewer's language, so render it inside <Suspense>.
 */
export async function PickLink() {
  const { t } = await getI18n();
  const text = t.pick.homeLink;
  return (
    <div
      data-pick-card
      className="group card relative grid gap-3 py-4 transition duration-150 ease-(--ease-spring) has-[>a:hover]:-translate-y-1 has-[>a:hover]:-rotate-1 has-[>a:hover]:shadow-[8px_8px_0_var(--outline)] has-[>a:active]:translate-x-1 has-[>a:active]:translate-y-1 has-[>a:active]:shadow-[2px_2px_0_var(--outline)]"
    >
      {/* Stretched over the whole card, under the shortcuts. */}
      <Link href="/pick" className="flex items-center gap-4 after:absolute after:inset-0 after:rounded-[inherit]">
        <Dice />
        <span className="grid min-w-0 flex-1 gap-1">
          <span className="display-ink text-2xl leading-[1.05]">{text.heading}</span>
          <span className="text-sm font-medium text-muted">{text.body}</span>
        </span>
        <ArrowIcon className="size-6 transition-transform duration-200 ease-(--ease-spring) group-has-[>a:hover]:translate-x-1" />
      </Link>
      <div className="relative flex flex-wrap gap-2 sm:pl-20">
        <Link href={`/pick?time=${SURPRISE_MINUTES}&surprise=1`} className="group/surprise btn px-3 py-1.5 text-[0.95rem]">
          <SparkIcon />
          {text.surprise}
        </Link>
        <Link href="/pick/swipe" className="btn-quiet px-3 py-1">
          <ShuffleIcon className="size-6" />
          {text.swipe}
        </Link>
      </div>
    </div>
  );
}

/** A sparkle that spins when "Surprise us" is pointed at. */
function SparkIcon() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      className="size-5 shrink-0 transition-transform duration-300 ease-(--ease-spring) group-hover/surprise:rotate-90"
    >
      <path
        d="M12 2.5c.6 4.4 2.6 6.6 7 7.5-4.4.9-6.4 3.1-7 7.5-.6-4.4-2.6-6.6-7-7.5 4.4-.9 6.4-3.1 7-7.5z"
        fill="var(--surface)"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinejoin="round"
      />
      <circle cx="19" cy="19" r="1.6" fill="currentColor" />
    </svg>
  );
}

const PIPS: Record<number, [number, number][]> = {
  5: [
    [9, 9],
    [21, 9],
    [15, 15],
    [9, 21],
    [21, 21],
  ],
  3: [
    [9, 9],
    [15, 15],
    [21, 21],
  ],
};

/** A pair of dice, one in each person's colour, that wobble when the card is pointed at. */
function Dice() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 64 56"
      className="h-14 w-16 shrink-0 overflow-visible motion-safe:group-has-[>a:hover]:animate-[wiggle_0.45s_ease-in-out_2]"
    >
      <Die x={2} y={14} turn={-14} fill="var(--me)" pips={PIPS[5]} />
      <Die x={30} y={4} turn={12} fill="var(--partner)" pips={PIPS[3]} />
    </svg>
  );
}

function Die({ x, y, turn, fill, pips }: { x: number; y: number; turn: number; fill: string; pips: [number, number][] }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${turn} 15 15)`}>
      <rect x="2" y="2" width="28" height="28" rx="7" fill="var(--outline)" transform="translate(3 3)" />
      <rect x="2" y="2" width="28" height="28" rx="7" fill={fill} stroke="var(--outline)" strokeWidth={3} />
      {pips.map(([cx, cy]) => (
        <circle key={`${cx}-${cy}`} cx={cx + 1} cy={cy + 1} r={2.6} fill="var(--outline)" />
      ))}
    </g>
  );
}
