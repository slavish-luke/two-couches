/**
 * The everyday touches of Phase 10 (Sprint 25), delegated from the document so no component has to opt in:
 * jelly buttons (.btn, .btn-quiet), ink chips (.chip), the "We can both watch" couches (<BothSwitch>) and
 * trading-card posters ([data-title-card] .poster-frame). Browser only; installed once by <MotionEffects>.
 * The spec is design/labs/motion-lab.html (scenes `cards` and `controls`).
 *
 * Nothing here changes React's DOM: animations go through WAAPI (anim()), and the only writes are data
 * attributes and custom properties React doesn't manage (data-ink, data-going, data-tilt, --mx…), each
 * cleared again when the element settles.
 */
import { sparkles } from "./fx";
import { amp, anim, center, isCalm, isReduced, isWild, OUT, sc, SPRING } from "./motion";

/** Every way a chip says it's the chosen one (as `.chip` styles it in globals.css). */
export const CHIP_SELECTED =
  '[aria-pressed="true"], [aria-current="page"], [aria-current="true"], [aria-checked="true"], :has(input:checked)';

/** How far each couch in <BothSwitch> scoots towards the other when it turns on (keep in step with globals.css). */
const SCOOT_PX = 5;

const JELLY = ".btn, .btn-quiet";

function isDisabled(el: Element) {
  return el.matches(":disabled, [aria-disabled='true']") || el.querySelector("input:disabled") !== null;
}

/**
 * Calls `release` once `settled()` is true, the element has left the page, or `timeout` passes: for a
 * touch that runs before the click's result arrives (a link chip's new page, a state update).
 */
function holdUntil(el: Element, settled: () => boolean, release: () => void, timeout = 8000) {
  const start = performance.now();
  const timer = window.setInterval(() => {
    if (!el.isConnected || settled() || performance.now() - start > timeout) {
      window.clearInterval(timer);
      release();
    }
  }, 100);
}

/* ---------------------------------------------- Jelly buttons ---------------------------------------------- */

const ORIGIN = "50% 100%";
const squashed = (): Keyframe => ({ transform: `scale(${sc(1.08)}, ${sc(0.86)})`, transformOrigin: ORIGIN });

function wobble(button: HTMLElement) {
  void anim(
    button,
    [
      squashed(),
      { transform: `scale(${sc(0.93)}, ${sc(1.1)})`, transformOrigin: ORIGIN },
      { transform: `scale(${sc(1.04)}, ${sc(0.97)})`, transformOrigin: ORIGIN },
      { transform: `scale(${sc(0.99)}, ${sc(1.01)})`, transformOrigin: ORIGIN },
      { transform: "none", transformOrigin: ORIGIN },
    ],
    { duration: 520, easing: "ease-out" },
  );
  if (isWild() && button.classList.contains("btn")) {
    const { x, rect } = center(button);
    sparkles(x, rect.top, { count: 6 });
  }
}

function installJelly(signal: AbortSignal) {
  let pressed: { button: HTMLElement; squash: Animation } | null = null;

  function release() {
    if (!pressed) return;
    const { button, squash } = pressed;
    pressed = null;
    squash.cancel();
    wobble(button);
  }

  document.addEventListener(
    "pointerdown",
    (event) => {
      if (event.button !== 0 || isReduced()) return;
      const button = (event.target as Element).closest<HTMLElement>(JELLY);
      if (!button || isDisabled(button)) return;
      pressed?.squash.cancel();
      pressed = {
        button,
        squash: anim(button, [{ transform: "none", transformOrigin: ORIGIN }, squashed()], { duration: 90, easing: "ease-out", fill: "forwards" }),
      };
    },
    { signal, passive: true },
  );
  document.addEventListener("pointerup", release, { signal, passive: true });
  document.addEventListener("pointercancel", release, { signal, passive: true });
  document.addEventListener(
    "pointerout",
    (event) => {
      if (pressed && !pressed.button.contains(event.relatedTarget as Node | null)) release();
    },
    { signal, passive: true },
  );
  // Enter or Space: a click with no pointer (detail 0) gets the whole jelly.
  document.addEventListener(
    "click",
    (event) => {
      if (event.detail !== 0 || isReduced()) return;
      const button = (event.target as Element).closest<HTMLElement>(JELLY);
      if (button && !isDisabled(button)) wobble(button);
    },
    { signal, capture: true },
  );
}

/* ----------------------------------------- Ink chips and both couches ----------------------------------------- */

/** Fills a chip with its chosen colour from (x, y) inside it, then holds the fill until the chip is chosen. */
function inkFill(chip: HTMLElement, x: number, y: number) {
  const { width } = chip.getBoundingClientRect();
  chip.dataset.ink = "";
  const fill = anim(
    chip,
    [{ clipPath: `circle(0px at ${x}px ${y}px)` }, { clipPath: `circle(${width * 1.2}px at ${x}px ${y}px)` }],
    { duration: 380, easing: OUT, fill: "forwards", pseudoElement: "::before" },
  );
  void anim(chip, [{ transform: "none" }, { transform: `scale(${sc(1.1)})` }, { transform: "none" }], { duration: 300, easing: SPRING });
  void fill.finished.then(() =>
    holdUntil(
      chip,
      () => chip.matches(CHIP_SELECTED),
      () => {
        fill.cancel();
        delete chip.dataset.ink;
      },
    ),
  );
}

/** The two couches in a "We can both watch" chip scoot together (on) or apart (off), as the lab's switch. */
function scoot(chip: HTMLElement, toggle: HTMLElement, on: boolean) {
  toggle.dataset.going = on ? "on" : "off";
  const release = () => delete toggle.dataset.going;
  holdUntil(chip, () => chip.matches(CHIP_SELECTED) === on, release);
  if (isReduced()) return;
  const calm = isCalm();
  const hop = calm ? 0 : -8 * amp();
  const seats = [toggle.querySelector<HTMLElement>('[data-seat="me"]'), toggle.querySelector<HTMLElement>('[data-seat="partner"]')];
  seats.forEach((seat, i) => {
    if (!seat) return;
    const x = on ? (i ? -SCOOT_PX : SCOOT_PX) : 0;
    const from = on ? 0 : i ? -SCOOT_PX : SCOOT_PX;
    void anim(
      seat,
      [
        { transform: `translateX(${from}px)` },
        { transform: `translate(${(from + x) / 2}px, ${hop}px) rotate(${(i ? -1 : 1) * 10 * amp()}deg)` },
        { transform: `translateX(${x}px)` },
      ],
      { duration: calm ? 200 : 420, easing: "ease-out", delay: i * 40 },
    );
  });
  if (on && !calm) {
    window.setTimeout(() => {
      const { x, y } = center(toggle);
      sparkles(x, y - 6, { count: 7, colors: ["var(--blush)", "var(--stamp)"], distance: 45, kind: "heart" });
    }, 380);
  }
}

function installChips(signal: AbortSignal) {
  let last: { chip: Element; at: number } | null = null;
  document.addEventListener(
    "click",
    (event) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target as Element;
      const chip = target.closest<HTMLElement>(".chip");
      if (!chip || isDisabled(chip)) return;
      // A tap on a label chip also clicks its hidden input: one touch per tap.
      if (last && last.chip === chip && performance.now() - last.at < 80) return;
      last = { chip, at: performance.now() };
      const chosen = chip.matches(CHIP_SELECTED);
      const toggle = chip.querySelector<HTMLElement>("[data-both-switch]");
      if (toggle) scoot(chip, toggle, !chosen);
      if (chosen || isCalm()) return;
      const rect = chip.getBoundingClientRect();
      const pointer = event.detail !== 0 && event.clientX !== 0;
      inkFill(chip, pointer ? event.clientX - rect.left : rect.width / 2, pointer ? event.clientY - rect.top : rect.height / 2);
    },
    { signal, capture: true },
  );
}

/* --------------------------------------------- Trading-card posters --------------------------------------------- */

function installCards(signal: AbortSignal) {
  let tilted: HTMLElement | null = null;

  function untilt() {
    if (!tilted) return;
    tilted.style.removeProperty("transform");
    tilted.style.removeProperty("transition");
    delete tilted.dataset.tilt;
    tilted = null;
  }

  const frameOf = (target: EventTarget | null) =>
    (target as Element | null)?.closest?.("[data-title-card]")?.querySelector<HTMLElement>(".poster-frame") ?? null;

  document.addEventListener(
    "pointermove",
    (event) => {
      if (event.pointerType !== "mouse") return;
      const frame = frameOf(event.target);
      if (frame !== tilted) untilt();
      if (!frame || isCalm()) return;
      const rect = frame.getBoundingClientRect();
      const px = (event.clientX - rect.left) / rect.width - 0.5;
      const py = (event.clientY - rect.top) / rect.height - 0.5;
      const deg = isWild() ? 16 : 9;
      tilted = frame;
      frame.dataset.tilt = "";
      frame.style.transition = "transform .08s linear";
      frame.style.transform = `perspective(800px) rotateY(${(px * deg).toFixed(2)}deg) rotateX(${(-py * deg).toFixed(2)}deg) translateY(-6px) scale(1.03)`;
      frame.style.setProperty("--mx", `${((px + 0.5) * 100).toFixed(1)}%`);
      frame.style.setProperty("--my", `${((py + 0.5) * 100).toFixed(1)}%`);
      frame.style.setProperty("--hx", `${Math.round(px * 360)}deg`);
    },
    { signal, passive: true },
  );
  document.addEventListener(
    "pointerout",
    (event) => {
      if (tilted && !tilted.closest("[data-title-card]")?.contains(event.relatedTarget as Node | null)) untilt();
    },
    { signal, passive: true },
  );

  // Press: the poster squashes under a mouse; a finger gets the lab's little wobble straight away (as on
  // the lab's cards: a tap opens the title, so on release would be too late to see). A scroll that starts on
  // a card cancels the pointer, and the wobble with it.
  let wobbling: Animation | null = null;
  document.addEventListener(
    "pointerdown",
    (event) => {
      if (event.button !== 0 || isReduced()) return;
      const frame = frameOf(event.target);
      if (!frame) return;
      if (event.pointerType === "mouse") {
        void anim(frame, [{ scale: 1 }, { scale: sc(0.95) }, { scale: 1 }], { duration: 260, easing: SPRING });
        return;
      }
      const card = frame.closest("[data-title-card]");
      if (!card) return;
      const a = amp();
      wobbling?.cancel();
      wobbling = anim(
        card,
        [{ transform: "none" }, { transform: `rotate(${-3 * a}deg) scale(.96)` }, { transform: `rotate(${2 * a}deg) scale(1.02)` }, { transform: "none" }],
        { duration: 420, easing: "ease-out" },
      );
    },
    { signal, passive: true },
  );
  document.addEventListener(
    "pointercancel",
    () => {
      wobbling?.cancel();
      wobbling = null;
    },
    { signal, passive: true },
  );
  // Opening a title: flatten the card first, so the poster morphs into the title page from where it lies.
  document.addEventListener(
    "click",
    (event) => {
      const frame = frameOf(event.target);
      if (frame && frame === tilted) {
        frame.style.transition = "none";
        frame.style.removeProperty("transform");
        delete frame.dataset.tilt;
        tilted = null;
        requestAnimationFrame(() => frame.style.removeProperty("transition"));
      }
    },
    { signal, capture: true },
  );
}

/** Installs every everyday touch; abort the signal to remove them. */
export function installTouches(signal: AbortSignal) {
  installJelly(signal);
  installChips(signal);
  installCards(signal);
}
