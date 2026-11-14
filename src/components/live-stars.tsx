"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";
import { dropInStars } from "@/lib/list-motion";
import { Stars } from "./stars";

/** The last rating each LiveStars showed on this device (until the page reloads), by `memory` key. */
const seen = new Map<string, number>();

/**
 * Someone's read-only stars that drop in one after another when the rating changes while you're looking
 * (your partner's, arriving through ListSync), or `fallback` while there's none. `memory` names the rating
 * (e.g. `<item id>:<profile id>`), so a change is noticed even if this remounts; the first time a rating is
 * shown it simply appears.
 */
export function LiveStars({
  memory,
  rating,
  who,
  language,
  className,
  fallback = null,
}: {
  memory: string;
  rating: number | null | undefined;
  who: string;
  language: string;
  className?: string;
  fallback?: ReactNode;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const value = rating ?? 0;

  useLayoutEffect(() => {
    const before = seen.get(memory);
    seen.set(memory, value);
    if (before === undefined || before === value || !value || !ref.current) return;
    dropInStars([...ref.current.querySelectorAll("svg")], value);
  }, [memory, value]);

  if (!value) return fallback;
  return (
    <span ref={ref} className={className}>
      <Stars rating={value} who={who} language={language} />
    </span>
  );
}
