import type { CSSProperties, ReactNode } from "react";

/*
 * The pieces every page's loading state is drawn from. Each one is the real thing's class with a no-break
 * space for content (a `.chip`, a `.tab`, a `.field`, a `.btn`, a line in the text's own size), so it takes
 * exactly the height the loaded page will, in every skin, and only its width is a guess. Wordless, drawn
 * in the skin's outlines and tokens; the bars pulse only with motion allowed.
 */

/** Content for a blank that must keep a line's height. */
export const NBSP = " ";

/** Fills for a bar inside a line of text, by what the line sits on. */
const BAR = {
  /** Body text on paper, on the ground or in the spotlight: a soft bar in the text's own colour. */
  text: "rounded-full bg-current/15 motion-safe:animate-pulse",
  /** Cartoon lettering on the ground (`display`): a paper cut-out with an ink edge and a hard shadow. */
  lettering: "rounded-[0.18em] border-[3px] border-outline bg-surface shadow-[0.07em_0.07em_0_var(--outline)]",
  /** The spotlight's head (`display-pop`): the same cut-out in the spotlight-head colour. */
  pop: "rounded-[0.18em] border-[3px] border-outline bg-(--accent-head) shadow-[0.07em_0.07em_0_var(--outline)]",
  /** Lettering on paper (`display-ink`): a plain bar in ink. */
  ink: "rounded-[0.18em] bg-current/20 motion-safe:animate-pulse",
} as const;

/** The root of a page's loading state. Mirror the page root's classes so the blocks land where the page's will. */
export function Skeleton({ wide = false, className = "", children }: { wide?: boolean; className?: string; children: ReactNode }) {
  return (
    <div aria-busy data-wide={wide || undefined} className={className}>
      {children}
    </div>
  );
}

/**
 * One line of text at its real height. `className` carries the text's own classes (size, font, leading,
 * margins), so the line is as tall as the text it stands for; the bar is drawn inside it at `width`.
 */
export function SkelText({
  className = "",
  width = "60%",
  bar = "text",
}: {
  className?: string;
  width?: CSSProperties["width"];
  bar?: keyof typeof BAR;
}) {
  return (
    <span aria-hidden className={`relative block max-w-full ${className}`} style={{ width }}>
      <span className={`absolute inset-x-0 top-1/2 h-[0.72em] -translate-y-1/2 ${BAR[bar]}`} />
      {NBSP}
    </span>
  );
}

/**
 * A page title on the ground, as tall as the real `display` one. `twoLinesOnPhones` for the long titles
 * that wrap at phone width ("Plan a watch night").
 */
export function SkelPageTitle({
  width = "11rem",
  twoLinesOnPhones = false,
  className = "",
}: {
  width?: CSSProperties["width"];
  twoLinesOnPhones?: boolean;
  className?: string;
}) {
  const type = "display -rotate-1 text-[clamp(2.4rem,5vw,3.6rem)]";
  if (!twoLinesOnPhones) return <SkelText bar="lettering" width={width} className={`${type} ${className}`} />;
  return (
    <span aria-hidden className={`grid ${type} ${className}`}>
      <SkelText bar="lettering" width="9rem" className="sm:hidden" />
      <SkelText bar="lettering" width={width} />
    </span>
  );
}

/**
 * Poster blanks at `<Poster>`'s sizes: xs 40×60, sm 64×96, md 92×138, lg 200×300 (240×360 from `sm`, as the
 * title page shows it), or fluid (fills its container, 2:3).
 */
const POSTER = {
  xs: "h-[60px] w-10",
  sm: "h-24 w-16",
  md: "h-[138px] w-[92px]",
  lg: "h-[300px] w-[200px] sm:h-[360px] sm:w-[240px]",
  fluid: "aspect-[2/3] w-full",
} as const;

export function SkelPoster({ size, className = "" }: { size: keyof typeof POSTER; className?: string }) {
  return <span aria-hidden className={`block shrink-0 rounded-poster border-[3px] border-outline bg-accent-soft ${POSTER[size]} ${className}`} />;
}

/** A filter chip; `logo` for the service chips that lead with a round logo. */
export function SkelChip({ width = "5.5rem", logo = false, className = "" }: { width?: CSSProperties["width"]; logo?: boolean; className?: string }) {
  return (
    <span aria-hidden className={`chip pointer-events-none ${logo ? "py-0.5 pl-1" : ""} ${className}`} style={{ width }}>
      {logo && <span className="size-6 shrink-0 rounded-full border-2 border-outline bg-accent-soft" />}
      {NBSP}
    </span>
  );
}

/** A view tab (`.tab`); pass the page's own size classes. */
export function SkelTab({ width = "8rem", className = "" }: { width?: CSSProperties["width"]; className?: string }) {
  return (
    <span aria-hidden className={`tab pointer-events-none block ${className}`} style={{ width }}>
      {NBSP}
    </span>
  );
}

/** A `.btn`, `.btn-quiet`, or anything else button-shaped via `className`; `icon` reserves an icon's height. */
export function SkelButton({
  quiet = false,
  width = "8rem",
  icon,
  className = "",
}: {
  quiet?: boolean;
  width?: CSSProperties["width"];
  /** The icon's size class (e.g. "size-5") when the real button has one, since it can be taller than the text. */
  icon?: string;
  className?: string;
}) {
  return (
    <span aria-hidden className={`${quiet ? "btn-quiet" : "btn"} pointer-events-none ${className}`} style={{ width }}>
      {icon && <span className={`shrink-0 ${icon}`} />}
      {NBSP}
    </span>
  );
}

/**
 * A text field (`.field`); pass the real one's extra classes (padding, text size). `lines` for a textarea's
 * rows. `select` draws an empty, inert `<select>`, because browsers size a select by its font, not by the
 * line height a text field uses.
 */
export function SkelField({ className = "", lines = 1, select = false }: { className?: string; lines?: number; select?: boolean }) {
  if (select) {
    return <select aria-hidden disabled tabIndex={-1} className={`field pointer-events-none block ${className}`} />;
  }
  return (
    <span aria-hidden className={`field pointer-events-none block ${className}`}>
      {Array.from({ length: lines }, (_, i) => (
        <span key={i} className="block">
          {NBSP}
        </span>
      ))}
    </span>
  );
}

/** A labelled select, like `<FilterSelect>`: a label line over a field. */
export function SkelSelect({ labelWidth = "40%" }: { labelWidth?: CSSProperties["width"] }) {
  return (
    <span aria-hidden className="grid gap-1 text-sm font-bold">
      <SkelText width={labelWidth} />
      <SkelField select className="py-1.5 text-[15px] font-medium" />
    </span>
  );
}

/**
 * A poster card like `<TitleCard>`: the outlined poster, the title (`titleLines` of it), the year or
 * `details` lines, and the "+ Add" button when `add`. `className` is the card's own (width, text size).
 */
export function SkelTitleCard({
  className = "",
  titleLines = 2,
  lastTitleLine = "",
  details = 1,
  add = true,
  extra,
}: {
  className?: string;
  titleLines?: number;
  /** Classes for the title's last line, e.g. "lg:hidden" where cards are wide enough for one line. */
  lastTitleLine?: string;
  /** How many detail lines (the year is one), or the detail's own skeleton. */
  details?: number | ReactNode;
  add?: boolean;
  /** Anything after the button, e.g. "Not interested". */
  extra?: ReactNode;
}) {
  return (
    <li aria-hidden className={`grid content-start justify-items-start gap-1.5 ${className}`}>
      <span className="mb-1.5 block w-full">
        <SkelPoster size="fluid" className="shadow-[4px_4px_0_var(--outline)]" />
      </span>
      <span className="grid w-full font-bold leading-snug">
        {Array.from({ length: titleLines }, (_, i) => (
          <SkelText
            key={i}
            className={i === titleLines - 1 && titleLines > 1 ? lastTitleLine : ""}
            width={i === titleLines - 1 && titleLines > 1 ? "55%" : "90%"}
          />
        ))}
      </span>
      {typeof details === "number"
        ? Array.from({ length: details }, (_, i) => <SkelText key={i} className="text-sm" width={i === 0 ? "35%" : "60%"} />)
        : details}
      {add && <SkelButton quiet width="4.5rem" icon="size-3.5" className="px-2.5 py-0.5 text-sm" />}
      {extra}
    </li>
  );
}

/**
 * Text lines for a paragraph: `lines` bars at the text's own leading, the last one shorter. `smLines` is
 * how many it wraps to from `sm`, where the column is wider (default: the same).
 */
export function SkelParagraph({ lines = 2, smLines = lines, className = "" }: { lines?: number; smLines?: number; className?: string }) {
  const count = Math.max(lines, smLines);
  return (
    <span aria-hidden className={`grid ${className}`}>
      {Array.from({ length: count }, (_, i) => {
        // Lines past the phone count show from sm; lines past the sm count hide there.
        const shown = i < lines && i < smLines ? "" : i < lines ? "sm:hidden" : "max-sm:hidden";
        const last = i === lines - 1 || i === smLines - 1;
        return <SkelText key={i} className={shown} width={last ? "55%" : "100%"} />;
      })}
    </span>
  );
}
