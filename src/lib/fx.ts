/**
 * Effects drawn over the whole page (Phase 10): sparkles, confetti, comic sound words and the ground's
 * flare. Browser only. Everything goes into one fixed layer (`.fx-layer`, created on first use, outside
 * React's tree) that never takes pointer events and clips its contents, so effects can't widen the page or
 * block a tap. Each piece removes itself when its animation ends. Nothing here runs under reduced motion,
 * and sparkles/confetti scale with the level (see src/lib/motion.ts).
 *
 * Colours are CSS custom properties (`var(--me)`), so effects follow the skin and palette. Each skin picks
 * its particle shape with `[data-skin=…]` rules on `.fx-particle [data-shape]` in globals.css: every
 * particle carries all shapes and the skin shows one (like the stickers in src/app/stats/sticker.tsx).
 */
import { getMessages } from "./i18n";
import { amp, anim, isCalm, isReduced, isWild, OUT } from "./motion";

const SVG = "http://www.w3.org/2000/svg";

/** The fixed effects layer, created on first use. */
export function fxLayer(): HTMLElement {
  let layer = document.querySelector<HTMLElement>(".fx-layer");
  if (!layer) {
    layer = document.createElement("div");
    layer.className = "fx-layer";
    layer.setAttribute("aria-hidden", "true");
    document.body.append(layer);
  }
  return layer;
}

const rand = (a: number, b: number) => a + Math.random() * (b - a);

export function sparklePath(x: number, y: number, r: number) {
  const w = r * 0.32;
  return `M${x} ${y - r}Q${x + w} ${y - w} ${x + r} ${y}Q${x + w} ${y + w} ${x} ${y + r}Q${x - w} ${y + w} ${x - r} ${y}Q${x - w} ${y - w} ${x} ${y - r}Z`;
}

export function heartPath(x: number, y: number, r: number) {
  return `M${x} ${y + r}C${x - r * 1.6} ${y - r * 0.1} ${x - r * 0.9} ${y - r * 1.5} ${x} ${y - r * 0.5}C${x + r * 0.9} ${y - r * 1.5} ${x + r * 1.6} ${y - r * 0.1} ${x} ${y + r}Z`;
}

/** Five-point star path centred on (cx, cy). */
export function starPath(cx: number, cy: number, outer: number, inner: number) {
  let d = "";
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? inner : outer;
    const a = (Math.PI * i) / 5 - Math.PI / 2;
    d += `${i ? "L" : "M"}${(cx + r * Math.cos(a)).toFixed(1)} ${(cy + r * Math.sin(a)).toFixed(1)}`;
  }
  return `${d}Z`;
}

export type ParticleKind = "sparkle" | "heart";

/**
 * One particle as an SVG. `sparkle` carries every skin's shapes (`data-shape` sparkle / sticker / burst /
 * sprinkle) and the skin's CSS shows one; `heart` is always a heart.
 */
function particle(kind: ParticleKind, size: number, color: string): SVGSVGElement {
  const el = document.createElementNS(SVG, "svg");
  el.setAttribute("viewBox", "-10 -10 20 20");
  el.setAttribute("width", String(size));
  el.setAttribute("height", String(size));
  el.setAttribute("class", "fx-particle");
  const stroke = `stroke="var(--outline)" stroke-width="1.6" stroke-linejoin="round"`;
  el.innerHTML =
    kind === "heart"
      ? `<path d="${heartPath(0, 0, 6)}" fill="${color}" ${stroke}/>`
      : `<path data-shape="sparkle" d="${sparklePath(0, 0, 9)}" fill="${color}" ${stroke}/>` +
        `<circle data-shape="sticker" r="6.5" fill="${color}" stroke="var(--p-surface)" stroke-width="2.5"/>` +
        `<path data-shape="burst" d="${starPath(0, 0, 9, 4.5)}" fill="${color}" ${stroke}/>` +
        `<rect data-shape="sprinkle" x="-2.2" y="-7" width="4.4" height="14" rx="2.2" fill="${color}" ${stroke}/>`;
  return el;
}

const DEFAULT_COLORS = ["var(--pop)", "var(--stamp)", "var(--partner)", "var(--me)"];

/**
 * A burst of particles flying out from (x, y) in viewport coordinates. `count` is the Lively count (half at
 * Calm, 1.6× at Wild); `distance` is how far they fly at Lively. Nothing under reduced motion.
 */
export function sparkles(
  x: number,
  y: number,
  { count = 10, colors = DEFAULT_COLORS, distance = 70, kind = "sparkle" }: { count?: number; colors?: string[]; distance?: number; kind?: ParticleKind } = {},
) {
  if (isReduced()) return;
  const layer = fxLayer();
  const n = Math.round(count * (isCalm() ? 0.5 : isWild() ? 1.6 : 1));
  for (let i = 0; i < n; i++) {
    const size = rand(8, 16);
    const el = particle(kind, size, colors[i % colors.length]);
    el.style.left = `${x - size / 2}px`;
    el.style.top = `${y - size / 2}px`;
    layer.append(el);
    const a = rand(0, Math.PI * 2);
    const r = distance * rand(0.55, 1.15) * Math.max(0.7, amp());
    void anim(
      el,
      [
        { transform: "translate(0,0) scale(0) rotate(0deg)", opacity: 1 },
        { transform: `translate(${Math.cos(a) * r}px, ${Math.sin(a) * r}px) scale(1) rotate(${rand(-90, 90)}deg)`, opacity: 1, offset: 0.6 },
        { transform: `translate(${Math.cos(a) * r * 1.15}px, ${Math.sin(a) * r * 1.15 + 14}px) scale(.3) rotate(${rand(-120, 120)}deg)`, opacity: 0 },
      ],
      { duration: rand(650, 900), easing: OUT },
    ).finished.then(() => el.remove());
  }
}

/**
 * Confetti from (x, y) thrown towards one side (`toward` 1 = right, -1 = left). Pieces that fly past the
 * middle of the screen change from `color` to `meetColor` on the way (your colour and your partner's turn
 * `--stamp` where they cross). Only at Lively and Wild.
 */
export function confetti(x: number, y: number, { toward, count, color, meetColor }: { toward: 1 | -1; count: number; color: string; meetColor: string }) {
  if (isCalm()) return;
  const layer = fxLayer();
  for (let i = 0; i < count; i++) {
    const el = document.createElement("div");
    el.className = "fx-confetti";
    const w = rand(7, 11);
    const h = rand(11, 17);
    el.style.cssText = `width:${w}px;height:${h}px;left:${x}px;top:${y}px;border-radius:${Math.random() < 0.3 ? "50%" : "2px"};background:${color};`;
    layer.append(el);
    const vx = toward * rand(0.25, 1) * innerWidth * 0.55;
    const peak = -rand(0.35, 0.75) * innerHeight;
    const endY = rand(0.05, 0.35) * innerHeight;
    const crosses = Math.abs(vx) > innerWidth * 0.38;
    void anim(
      el,
      [
        { transform: "translate(0,0) rotate(0deg)", background: color },
        { transform: `translate(${vx * 0.55}px, ${peak}px) rotate(${rand(180, 540)}deg)`, background: crosses ? meetColor : color, offset: 0.45 },
        { transform: `translate(${vx}px, ${peak + innerHeight * 0.4 + endY}px) rotate(${rand(540, 1080)}deg)`, background: crosses ? meetColor : color, opacity: 0.9 },
      ],
      { duration: rand(1700, 2600), easing: "cubic-bezier(.2,.6,.4,1)", delay: rand(0, 220) },
    ).finished.then(() => el.remove());
  }
}

/** The milestone salvo: your colour from the bottom-left corner, your partner's from the bottom-right. */
export function confettiFromBothSides() {
  const count = isWild() ? 70 : 36;
  confetti(20, innerHeight - 20, { toward: 1, count, color: "var(--me)", meetColor: "var(--stamp)" });
  confetti(innerWidth - 20, innerHeight - 20, { toward: -1, count, color: "var(--partner)", meetColor: "var(--stamp)" });
}

export type SfxKey = keyof ReturnType<typeof getMessages>["motion"]["sfx"];

/**
 * A comic sound word ("THWACK!") popping up at (x, y): only in POW! Comic Book, at Lively and Wild. The
 * word is in the page's language (<html lang>). Decoration, hidden from screen readers.
 */
export function sfx(key: SfxKey, x: number, y: number) {
  if (isCalm() || document.documentElement.getAttribute("data-skin") !== "comic") return;
  const word = getMessages(document.documentElement.lang || "en").motion.sfx[key];
  const el = document.createElement("div");
  el.className = "fx-sfx";
  el.textContent = word;
  if (isWild()) el.dataset.big = "";
  fxLayer().append(el);
  const w = el.offsetWidth;
  const h = el.offsetHeight;
  const rot = rand(-14, 14);
  el.style.left = `${Math.min(innerWidth - w - 8, Math.max(8, x - w / 2))}px`;
  el.style.top = `${Math.max(8, y - h / 2)}px`;
  void anim(
    el,
    [
      { transform: `scale(0) rotate(${rot - 20}deg)`, opacity: 1 },
      { transform: `scale(1.25) rotate(${rot}deg)`, opacity: 1, offset: 0.25 },
      { transform: `scale(1) rotate(${rot}deg)`, opacity: 1, offset: 0.4 },
      { transform: `scale(1.05) rotate(${rot}deg)`, opacity: 1, offset: 0.8 },
      { transform: `scale(1.2) rotate(${rot}deg)`, opacity: 0 },
    ],
    { duration: 1000, easing: "ease-out" },
  ).finished.then(() => el.remove());
}

/**
 * Asks the page ground to flare for a big moment (both can watch, both ready, a milestone). The ground
 * (Sprint 25) listens for the `fx-flare` event; nothing happens at Calm or under reduced motion.
 */
export function flare() {
  if (isCalm()) return;
  window.dispatchEvent(new Event("fx-flare"));
}
