"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Couch } from "@/components/couch";
import { amp, anim, isCalm, isReduced, onMotionChange, sc } from "@/lib/motion";

/*
 * Popcorn while it loads (Sprint 28, motion lab "popcorn"): when a page's skeleton has been up for
 * LOADER_DELAY_MS, your two couches toss a piece of popcorn between them over it. One per screen (the first
 * skeleton to wait wins), drawn in a fixed layer outside the page so the skeleton's layout never changes;
 * wordless and hidden from screen readers (the skeleton keeps `aria-busy`). Never under reduced motion (the
 * skeleton keeps its pulse); gentler at Calm. The loop pauses off screen and in a hidden tab.
 */

/** How long a load runs before the popcorn comes out. */
export const LOADER_DELAY_MS = 600;

let owner: symbol | null = null;

export function PopcornLoader() {
  const anchor = useRef<HTMLSpanElement>(null);
  /** Where the stage sits across the screen: over the middle of the skeleton (null: not shown). */
  const [left, setLeft] = useState<number | null>(null);

  useEffect(() => {
    if (isReduced()) return;
    const me = Symbol("popcorn");
    const timer = setTimeout(() => {
      if (owner) return;
      owner = me;
      const box = anchor.current?.parentElement?.getBoundingClientRect();
      const half = Math.min(160, (innerWidth - 48) / 2);
      const middle = box && box.width > 0 ? box.left + box.width / 2 : innerWidth / 2;
      setLeft(Math.min(innerWidth - half - 16, Math.max(half + 16, middle)));
    }, LOADER_DELAY_MS);
    return () => {
      clearTimeout(timer);
      if (owner === me) owner = null;
    };
  }, []);

  return (
    <>
      {/* No box (so the skeleton's grid is untouched); it only finds the skeleton to sit over. */}
      <span hidden ref={anchor} />
      {left !== null && createPortal(<PopcornStage left={left} />, document.body)}
    </>
  );
}

/** The lab's kernel: three puffs and a buttery middle. */
function Kernel() {
  return (
    <svg data-kernel viewBox="0 0 22 20" width={22} height={20} className="absolute left-0 top-0 overflow-visible">
      <g stroke="var(--outline)" strokeWidth={2} fill="var(--p-surface)">
        <circle cx="7" cy="9" r="5" />
        <circle cx="14" cy="7" r="5" />
        <circle cx="11" cy="13" r="5" />
      </g>
      <circle cx="11" cy="10" r="2" fill="var(--pop)" />
    </svg>
  );
}

function PopcornStage({ left }: { left: number }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const stage = ref.current;
    if (!stage) return;
    const kernel = stage.querySelector<SVGElement>("[data-kernel]");
    const me = stage.querySelector<HTMLElement>('[data-seat="me"]');
    const partner = stage.querySelector<HTMLElement>('[data-seat="partner"]');
    if (!kernel || !me || !partner) return;
    let anims: Animation[] = [];
    let visible = true;

    const start = () => {
      anims.forEach((a) => a.cancel());
      anims = [];
      if (isReduced()) return;
      // The lab's toss: an arc from your couch to your partner's and back, the kernel turning twice.
      const w = stage.clientWidth;
      const x0 = 44;
      const x1 = w - 66;
      const y = 56;
      const h = isCalm() ? 40 : 80 * Math.max(1, amp() * 0.9);
      const frames: Keyframe[] = [];
      const N = 24;
      for (let i = 0; i <= N; i++) {
        const p = i / N;
        const half = p < 0.5 ? p * 2 : (p - 0.5) * 2;
        const x = p < 0.5 ? x0 + (x1 - x0) * half : x1 - (x1 - x0) * half;
        frames.push({ transform: `translate(${x}px, ${y - h * 4 * half * (1 - half)}px) rotate(${p * 720}deg)`, offset: p });
      }
      const duration = isCalm() ? 1800 : 1400;
      anims.push(anim(kernel, frames, { duration, iterations: Infinity }));
      // Each couch squashes as it catches.
      const catchAt = (o: number): Keyframe[] => [
        { transform: "none", offset: 0 },
        { transform: "none", offset: Math.max(0, o - 0.06) },
        { transform: `scale(${sc(1.12)}, ${sc(0.86)}) translateY(2px)`, offset: o },
        { transform: "none", offset: Math.min(1, o + 0.1) },
        { transform: "none", offset: 1 },
      ];
      anims.push(anim(partner, catchAt(0.5), { duration, iterations: Infinity }));
      anims.push(anim(me, catchAt(0.96), { duration, iterations: Infinity }));
      if (!visible || document.hidden) anims.forEach((a) => a.pause());
    };
    const sync = () => {
      const run = visible && !document.hidden;
      anims.forEach((a) => (run ? a.play() : a.pause()));
    };

    start();
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      sync();
    });
    observer.observe(stage);
    document.addEventListener("visibilitychange", sync);
    const stopMotion = onMotionChange(() => {
      start();
    });
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", sync);
      stopMotion();
      anims.forEach((a) => a.cancel());
    };
  }, []);

  return (
    <div ref={ref} aria-hidden data-popcorn className="popcorn-loader" style={{ left }}>
      <span data-seat="me" className="popcorn-seat left-0">
        <Couch who="me" size={64} />
      </span>
      <span data-seat="partner" className="popcorn-seat right-0">
        <Couch who="partner" size={64} />
      </span>
      <Kernel />
    </div>
  );
}
