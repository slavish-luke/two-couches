"use client";

import { useState, useSyncExternalStore } from "react";
import { ChoiceTile } from "@/components/choice-tile";
import { DoneTag } from "@/components/done-tag";
import { WarningIcon } from "@/components/icons";
import { sparkles } from "@/lib/fx";
import { getMessages } from "@/lib/i18n";
import { center } from "@/lib/motion";
import { applyMotion, DEFAULT_MOTION, MOTION_LEVELS, savedMotion, type MotionLevel } from "@/lib/theme";

const REDUCE = "(prefers-reduced-motion: reduce)";
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  const query = matchMedia(REDUCE);
  window.addEventListener("storage", listener);
  window.addEventListener("motion-change", listener);
  query.addEventListener("change", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
    window.removeEventListener("motion-change", listener);
    query.removeEventListener("change", listener);
  };
}

const deviceReduces = () => matchMedia(REDUCE).matches;

/**
 * Calm, Lively or Wild, for this device only (src/lib/theme.ts sets <html data-motion>). The device's
 * reduced-motion setting always wins: then a note says so up front, and the choice is kept for later.
 */
export function MotionSettings({ language }: { language: string }) {
  // Wild on the server; the saved choice once hydrated.
  const level = useSyncExternalStore(subscribe, savedMotion, () => DEFAULT_MOTION);
  const reduced = useSyncExternalStore(subscribe, deviceReduces, () => false);
  const [saved, setSaved] = useState(false);
  const t = getMessages(language).motion.setting;

  function choose(next: MotionLevel, tile: HTMLElement) {
    applyMotion(next);
    setSaved(true);
    listeners.forEach((listener) => listener());
    // A taste of the new level (nothing at Calm or under reduced motion: sparkles() checks).
    if (next !== "calm") {
      const { x, rect } = center(tile);
      sparkles(x, rect.top + 12, { count: next === "wild" ? 8 : 5, distance: 50 });
    }
  }

  return (
    <div className="grid gap-4">
      {reduced && (
        <p className="flex items-start gap-2.5 rounded-control border-[3px] border-outline bg-accent-soft p-3 font-bold">
          <WarningIcon className="mt-0.5 size-5 shrink-0" />
          {t.reducedNow}
        </p>
      )}
      <fieldset className="grid gap-2.5">
        <legend className="sr-only">{t.heading}</legend>
        <div className="grid gap-3 sm:grid-cols-3">
          {MOTION_LEVELS.map((option) => (
            <ChoiceTile
              key={option}
              type="radio"
              name="motion"
              value={option}
              checked={level === option}
              onChange={() => choose(option, document.querySelector(`[data-motion-tile="${option}"]`) ?? document.body)}
              className="grid content-start gap-1 rounded-panel border-[3px] px-3.5 py-3 has-checked:shadow-[4px_4px_0_var(--outline)]"
            >
              <span data-motion-tile={option} className="text-lg font-bold leading-snug">
                {t.options[option]}
              </span>
              {/* No muted colour: the chosen tile is accent, and muted text fails on it. */}
              <span className="text-[15px] font-medium leading-snug">{t.notes[option]}</span>
            </ChoiceTile>
          ))}
        </div>
      </fieldset>
      {!reduced && <p className="text-sm font-medium text-muted">{t.reducedHint}</p>}
      {saved && <DoneTag status>{t.saved}</DoneTag>}
    </div>
  );
}
