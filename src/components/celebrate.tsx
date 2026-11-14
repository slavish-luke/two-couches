"use client";

import { useEffect, useRef } from "react";
import { confettiFromBothSides, flare, sfx, sparkles } from "@/lib/fx";
import { freshMilestones, readSeen, writeSeen } from "@/lib/moments";
import { amp, anim, center, isCalm, isReduced } from "@/lib/motion";

/*
 * Confetti that meets in the middle (Sprint 28, motion lab "confetti"). Rendered as a hidden span inside the
 * element that holds the milestones; each item names a milestone key (src/lib/moments.ts) and, optionally,
 * a selector for its sticker inside that element (else the element itself). The first time this device
 * sees a milestone's sticker on screen it is remembered (localStorage) and celebrated: the sticker drops
 * in, confetti flies from both bottom corners (yours from the left, your partner's from the right, turning
 * `--stamp` where they cross), the ground flares and POW! says its word. Calm: the drop and a few
 * sparkles. Reduced motion: nothing moves (it's still remembered).
 */

export type MilestoneItem = {
  /** The milestone's key (`milestoneKey` in src/lib/moments.ts). */
  id: string;
  /** Selector for the sticker to drop, inside the parent element. */
  target?: string;
  /** A sticker earned before: recorded quietly the first time this device sees any stickers. */
  seed?: boolean;
};

/** Targets that came into view together share one salvo. */
let pending: Element[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
/** At most one salvo every few seconds, however many milestones arrive. */
let lastSalvo = 0;
const SALVO_GAP_MS = 4000;

function drop(el: Element) {
  const a = Math.max(0.5, amp());
  void anim(
    el,
    [
      { transform: `translateY(${-120 * a}px) rotate(${-30 * a}deg) scale(.6)`, opacity: 0 },
      { transform: `translateY(${6 * a}px) rotate(${4 * a}deg) scale(1.08)`, opacity: 1, offset: 0.7 },
      { transform: "none", opacity: 1 },
    ],
    { duration: 560, easing: "ease-out" },
  );
}

function celebrate(targets: Element[]) {
  if (isReduced()) return;
  targets.forEach(drop);
  const first = center(targets[0]);
  if (isCalm()) {
    targets.forEach((t) => {
      const c = center(t);
      sparkles(c.x, c.y, { count: 10, distance: 80 });
    });
    return;
  }
  const now = Date.now();
  if (now - lastSalvo < SALVO_GAP_MS) {
    sparkles(first.x, first.y, { count: 10, distance: 80 });
    return;
  }
  lastSalvo = now;
  confettiFromBothSides();
  flare();
  sfx("party", first.x, first.y - 70);
}

function queue(target: Element) {
  pending.push(target);
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    const targets = pending.filter((t) => t.isConnected);
    pending = [];
    flushTimer = null;
    if (targets.length) celebrate(targets);
  }, 120);
}

export function Celebrate({ items }: { items: MilestoneItem[] }) {
  const ref = useRef<HTMLSpanElement>(null);
  // Re-run only when the milestones themselves change (a refresh with the same ones does nothing).
  const signature = items.map((i) => `${i.id}|${i.target ?? ""}|${i.seed ? 1 : 0}`).join(",");

  useEffect(() => {
    const scope = ref.current?.parentElement;
    if (!scope) return;
    const list: MilestoneItem[] = signature
      ? signature.split(",").map((s) => {
          const [id, target, seed] = s.split("|");
          return { id, target: target || undefined, seed: seed === "1" };
        })
      : [];
    const { fresh, seen } = freshMilestones(readSeen(), list);
    writeSeen(seen);
    if (fresh.length === 0) return;

    const byTarget = new Map<Element, MilestoneItem>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          observer.unobserve(entry.target);
          const item = byTarget.get(entry.target);
          if (!item) continue;
          const now = readSeen();
          if (now.keys.includes(item.id)) continue;
          writeSeen({ ...now, keys: [...now.keys, item.id] });
          queue(entry.target);
        }
      },
      { rootMargin: "0px 0px -15% 0px" },
    );
    for (const item of fresh) {
      const target = item.target ? scope.querySelector(item.target) : scope;
      if (!target) continue;
      byTarget.set(target, item);
      observer.observe(target);
    }
    return () => {
      observer.disconnect();
    };
  }, [signature]);

  return <span hidden ref={ref} />;
}
