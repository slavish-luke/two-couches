/**
 * Motion helpers shared by every animated piece (Phase 10). Browser only: call them from event handlers
 * and effects, never while rendering. The spec for every animation is design/labs/motion-lab.html; copy
 * its timings and keyframes, at all three levels.
 *
 * The level comes from <html data-motion> (Settings → On this device → Motion, src/lib/theme.ts), and the
 * device's reduced-motion setting always wins: then isCalm() and isReduced() are true and amp() is 0, so
 * code gives the lab's reduced alternative (a fade, a colour change, a tick) instead of movement.
 *
 * In CSS use the same switch: `[data-motion="wild"]`, `[data-motion="calm"]`, and wrap movement in
 * `@media (prefers-reduced-motion: no-preference)`.
 */
import { DEFAULT_MOTION, MOTION_LEVELS, type MotionLevel } from "./theme";

/** Easings from the lab: one overshoot (springy arrivals) and a confident deceleration. */
export const SPRING = "cubic-bezier(.3, 1.45, .5, 1)";
export const OUT = "cubic-bezier(.16, 1, .3, 1)";

const AMP: Record<MotionLevel, number> = { calm: 0.5, lively: 1, wild: 1.6 };

export function isReduced(): boolean {
  return typeof window === "undefined" || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** This device's chosen level, ignoring reduced motion (use isCalm()/amp() for decisions). */
export function motionLevel(): MotionLevel {
  if (typeof document === "undefined") return DEFAULT_MOTION;
  const value = document.documentElement.getAttribute("data-motion");
  return MOTION_LEVELS.includes(value as MotionLevel) ? (value as MotionLevel) : DEFAULT_MOTION;
}

/** True at Calm and under reduced motion: no flights, shakes, particles or sound words. */
export function isCalm(): boolean {
  return isReduced() || motionLevel() === "calm";
}

/** True only at Wild without reduced motion: the extras (screen jolts, confetti, foil, waving letters). */
export function isWild(): boolean {
  return !isReduced() && motionLevel() === "wild";
}

/** How far things move: 0 under reduced motion, 0.5 Calm, 1 Lively, 1.6 Wild. Multiply distances and angles. */
export function amp(): number {
  return isReduced() ? 0 : AMP[motionLevel()];
}

/** Scales a squash or stretch factor by the level: sc(1.2) is 1.1 at Calm, 1.2 Lively, 1.32 Wild, 1 reduced. */
export function sc(value: number): number {
  return 1 + (value - 1) * amp();
}

/**
 * Element.animate() whose `finished` never rejects: a cancelled animation (a second tap, a reset, the
 * element leaving the page) resolves instead of throwing an unhandled AbortError.
 */
export function anim(el: Element, frames: Keyframe[] | PropertyIndexedKeyframes, options: KeyframeAnimationOptions): Animation {
  const animation = el.animate(frames, { fill: "none", ...options });
  Object.defineProperty(animation, "finished", { value: animation.finished.catch(() => animation) });
  return animation;
}

export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export type Point = { x: number; y: number };

/** The centre of an element on screen (viewport coordinates), with its rect. */
export function center(el: Element): Point & { rect: DOMRect } {
  const rect = el.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, rect };
}

const easeInOut = (x: number) => (x < 0.5 ? 2 * x * x : 1 - (-2 * x + 2) ** 2 / 2);

/**
 * Flies an absolutely positioned element (left/top 0, normally in the fx layer) along an arc from a to b
 * in viewport coordinates, centred on the point. Run by requestAnimationFrame so it can follow a path;
 * `onStep` gets each position (for trails). Resolves at the end; `signal` stops it early.
 */
export function flyArc(
  el: HTMLElement | SVGElement,
  from: Point,
  to: Point,
  {
    lift = 120,
    duration = 800,
    scaleTo = 1,
    spin = 0,
    onStep,
    signal,
  }: { lift?: number; duration?: number; scaleTo?: number; spin?: number; onStep?: (x: number, y: number, progress: number) => void; signal?: AbortSignal } = {},
): Promise<void> {
  return new Promise((resolve) => {
    let start: number | null = null;
    function step(now: number) {
      if (signal?.aborted) return resolve();
      if (start === null) start = now;
      const p = Math.min(1, (now - start) / duration);
      const e = easeInOut(p);
      const x = from.x + (to.x - from.x) * e;
      const y = from.y + (to.y - from.y) * e - lift * 4 * e * (1 - e);
      const s = 1 + (scaleTo - 1) * e;
      el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%) scale(${s}) rotate(${spin * e}deg)`;
      onStep?.(x, y, p);
      if (p < 1) requestAnimationFrame(step);
      else resolve();
    }
    requestAnimationFrame(step);
  });
}

/** A short jolt (Lively and Wild; nothing at Calm or reduced motion). `px` is the Lively distance. */
export function shake(el: Element, px = 6): Animation | null {
  if (isCalm()) return null;
  const p = px * amp();
  return anim(
    el,
    [
      { transform: "none" },
      { transform: `translate(${-p}px, ${p / 2}px) rotate(-.5deg)` },
      { transform: `translate(${p}px, ${-p / 2}px) rotate(.5deg)` },
      { transform: `translate(${-p / 2}px, ${p / 3}px)` },
      { transform: `translate(${p / 3}px, 0)` },
      { transform: "none" },
    ],
    { duration: 340, easing: "linear" },
  );
}

/** Calls `fn` whenever this device's motion level changes (Settings), so loops can restart. Returns the unsubscribe. */
export function onMotionChange(fn: (level: MotionLevel) => void): () => void {
  const handler = (event: Event) => fn((event as CustomEvent<MotionLevel>).detail);
  window.addEventListener("motion-change", handler);
  return () => window.removeEventListener("motion-change", handler);
}
