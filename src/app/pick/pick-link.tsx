import Link from "next/link";
import { ArrowIcon } from "@/components/icons";
import { getI18n } from "@/lib/i18n/server";

/** The home page's way into /pick. Reads the viewer's language, so render it inside <Suspense>. */
export async function PickLink() {
  const { t } = await getI18n();
  return (
    <Link
      href="/pick"
      data-pick-card
      className="group card flex items-center gap-4 py-4 transition duration-150 ease-(--ease-spring) hover:-translate-y-1 hover:-rotate-1 hover:shadow-[8px_8px_0_var(--outline)] active:translate-x-1 active:translate-y-1 active:shadow-[2px_2px_0_var(--outline)]"
    >
      <Dice />
      <span className="grid min-w-0 flex-1 gap-1">
        <span className="display-ink text-2xl leading-[1.05]">{t.pick.homeLink.heading}</span>
        <span className="text-sm font-medium text-muted">{t.pick.homeLink.body}</span>
      </span>
      <ArrowIcon className="size-6 transition-transform duration-200 ease-(--ease-spring) group-hover:translate-x-1" />
    </Link>
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
      className="h-14 w-16 shrink-0 overflow-visible motion-safe:group-hover:animate-[wiggle_0.45s_ease-in-out_2]"
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
