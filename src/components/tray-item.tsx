"use client";

import { useId, useState, type ReactNode } from "react";
import { ChevronDownIcon } from "./icons";

/**
 * One of Home's cards, folded on phones (Sprint 24, the home order lab's option C): below the `lg` breakpoint
 * it shows only `summary`, as a chip in the "Waiting for you" tray or (`strip`) as a full-width strip in the
 * spotlight's colours, and tapping it opens the card in place. From `lg` up the card shows as it always did
 * and the chip is hidden. The card stays mounted while folded, so drafts and live updates carry on.
 *
 * A chip toggles (tap again to fold it); a strip opens for good, since the card it opens repeats its heading.
 */
export function TrayItem({
  summary,
  detail,
  strip = false,
  attention = false,
  className = "",
  children,
}: {
  /** What the chip or strip says, e.g. "How was Amélie?". */
  summary: ReactNode;
  /** A second line, on strips only (e.g. both local times). */
  detail?: ReactNode;
  strip?: boolean;
  /** A dot in your colour: something here is waiting for you (a question to answer, a title to answer). */
  attention?: boolean;
  /** For the page's layout, e.g. its place in Home's aside from lg up. */
  className?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const panel = useId();

  return (
    <div data-tray-item className={`min-w-0 ${open || strip ? "basis-full" : ""} lg:basis-full ${className}`}>
      {strip ? (
        !open && (
          <button
            type="button"
            aria-expanded={false}
            aria-controls={panel}
            onClick={() => setOpen(true)}
            className="spotlight flex w-full -rotate-1 items-center gap-3 px-4 py-3 text-left lg:hidden"
          >
            <span className="grid min-w-0 flex-1 gap-0.5">
              <span className="font-bold leading-snug">{summary}</span>
              {detail && <span className="text-sm font-semibold text-muted">{detail}</span>}
            </span>
            <ChevronDownIcon className="size-5 shrink-0" />
          </button>
        )
      ) : (
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panel}
          onClick={() => setOpen((o) => !o)}
          className="chip max-w-full text-left lg:hidden"
        >
          {attention && <span aria-hidden className="size-2.5 shrink-0 rounded-full border-2 border-outline bg-me" />}
          <span className="min-w-0">{summary}</span>
          <ChevronDownIcon className={`size-4 shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
        </button>
      )}
      <div id={panel} className={`${open ? (strip ? "" : "mt-3") : "hidden"} lg:mt-0 lg:block`}>
        {children}
      </div>
    </div>
  );
}
