/**
 * The ground that's alive (Phase 10, Sprint 25; the lab's `alive` scene). The loops themselves are CSS on
 * <Ground> (globals.css, "Sprint 25"): Sunburst's rays are still at Calm, drift at Lively (one turn in 240 s)
 * and drift faster at Wild, turning with the scroll too where `animation-timeline: scroll()` exists; Night
 * Owl's stars twinkle. This adds what CSS can't: the flare for big moments (fx.ts flare() → `fx-flare`), the
 * odd shooting star on Night Owl, and pausing every loop while the tab is hidden (<html data-hidden>).
 * Browser only; installed once by <MotionEffects>.
 */
import { anim, isCalm, isReduced, isWild, OUT } from "./motion";

const rand = (a: number, b: number) => a + Math.random() * (b - a);

const isNightOwl = () => document.documentElement.dataset.palette === "nightowl";
const hasRays = () => document.documentElement.dataset.skin === "saturday" && !isNightOwl();

/** A star streaking across Night Owl's sky, behind the page (in the ground, not the fx layer). */
export function shootingStar() {
  const ground = document.querySelector<HTMLElement>("[data-ground]");
  if (!ground || isReduced() || !isNightOwl()) return;
  const star = document.createElement("div");
  star.className = "ground-shooting-star";
  ground.append(star);
  const y = rand(40, innerHeight * 0.4);
  const x = rand(innerWidth * 0.1, innerWidth * 0.7);
  void anim(
    star,
    [
      { transform: `translate(${x}px, ${y}px) rotate(20deg) scaleX(.2)`, opacity: 0 },
      { transform: `translate(${x + 120}px, ${y + 44}px) rotate(20deg) scaleX(1)`, opacity: 1, offset: 0.3 },
      { transform: `translate(${x + 420}px, ${y + 154}px) rotate(20deg) scaleX(.4)`, opacity: 0 },
    ],
    { duration: 900, easing: "ease-out" },
  ).finished.then(() => star.remove());
}

/** The rays brighten and swell for a moment (Sunburst palettes); Night Owl gets a shooting star instead. */
function flareGround() {
  if (isCalm()) return;
  if (isNightOwl()) return shootingStar();
  const rays = document.querySelector<HTMLElement>("[data-ground-rays]");
  if (!rays || !hasRays()) return;
  void anim(
    rays,
    [
      { filter: "brightness(1) saturate(1)", scale: 1 },
      { filter: "brightness(1.12) saturate(1.3)", scale: 1.08, offset: 0.3 },
      { filter: "brightness(1) saturate(1)", scale: 1 },
    ],
    { duration: 1100, easing: OUT },
  );
}

export function installGround(signal: AbortSignal) {
  const root = document.documentElement;
  const visibility = () => root.toggleAttribute("data-hidden", document.hidden);
  visibility();
  document.addEventListener("visibilitychange", visibility, { signal });
  window.addEventListener("fx-flare", flareGround, { signal });

  // Every 6 s, sometimes, a shooting star (Lively and Wild, Night Owl, tab showing).
  const timer = window.setInterval(() => {
    if (document.hidden || isCalm() || !isNightOwl()) return;
    if (Math.random() < (isWild() ? 0.6 : 0.25)) shootingStar();
  }, 6000);
  signal.addEventListener("abort", () => window.clearInterval(timer));
}
