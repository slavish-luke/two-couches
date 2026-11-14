/**
 * Headings that land (Phase 10, Sprint 25; the lab's `letters` scene): a page's big heading (its visible
 * `h1.display`) drops in letter by letter and squashes on landing when you arrive on the page, the letters
 * hop as a mouse runs over them, and at Wild they keep a gentle wave going while it's there.
 *
 * The heading itself is never changed (React owns it, and screen readers read it once, normally): the
 * letters are an aria-hidden copy in the fx layer, drawn with the heading's own computed style over it,
 * while the heading is transparent (data-lettering). The copy goes as soon as the letters settle, the page
 * scrolls or resizes.
 *
 * "Arriving" is a new pathname whose heading shows within a few seconds (it may stream in after the page's
 * skeleton), after the page's own whoosh or peel has finished. Never on the first load (the intro has that),
 * refreshes, search-param changes or later Suspense reveals.
 */
import { fxLayer } from "./fx";
import { amp, anim, isCalm, isReduced, isWild, OUT } from "./motion";

const HEADING = "h1:is(.display, .display-pop, .display-ink)";
/** How long after a new pathname its heading may still arrive and land. */
const ARRIVAL_MS = 3000;
/** The heading is never left transparent longer than this. */
const SAFETY_MS = 6000;

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

/** Style properties of the copy that must not follow the heading's. */
const OWN_STYLE: Record<string, string> = {
  position: "absolute",
  margin: "0",
  "max-width": "none",
  "min-width": "0",
  "max-height": "none",
  "min-height": "0",
  opacity: "1",
  visibility: "visible",
  transition: "none",
  animation: "none",
  "pointer-events": "none",
  "view-transition-name": "none",
  overflow: "visible",
  contain: "none",
  "z-index": "auto",
  right: "auto",
  bottom: "auto",
  display: "block",
  "box-sizing": "border-box",
};

/** Where and how big the heading is: the copy sets these itself (physical and logical alike). */
const PLACEMENT = /^(inset|margin|left|right|top|bottom|position|width|height|min-|max-|block-size|inline-size|float|clear)/;

type Copy = { box: HTMLElement; letters: HTMLElement[] };

/** An aria-hidden copy of the heading's letters, one inline-block per grapheme, laid over it in the fx layer. */
function copyLetters(heading: HTMLElement): Copy | null {
  const text = heading.textContent ?? "";
  if (!text.trim() || heading.querySelector("svg, img, picture, video, input, button, select, textarea")) return null;
  const style = getComputedStyle(heading);
  const box = document.createElement("div");
  for (let i = 0; i < style.length; i++) {
    const property = style[i];
    if (PLACEMENT.test(property)) continue;
    box.style.setProperty(property, style.getPropertyValue(property));
  }
  for (const [property, value] of Object.entries(OWN_STYLE)) box.style.setProperty(property, value);
  const rect = heading.getBoundingClientRect();
  const width = heading.offsetWidth;
  const height = heading.offsetHeight;
  // The layout box without its rotation: the rotated box shares its centre.
  box.style.width = `${width}px`;
  box.style.height = `${height}px`;
  box.style.left = `${rect.left + rect.width / 2 - width / 2}px`;
  box.style.top = `${rect.top + rect.height / 2 - height / 2}px`;
  const lang = heading.closest<HTMLElement>("[lang]")?.lang || document.documentElement.lang || "en";
  box.lang = lang;
  box.dataset.lettering = "copy";

  const graphemes = new Intl.Segmenter(lang, { granularity: "grapheme" });
  const letters: HTMLElement[] = [];
  for (const part of text.trim().split(/(\s+)/)) {
    if (!part) continue;
    if (/^\s+$/.test(part)) {
      box.append(" ");
      continue;
    }
    const word = document.createElement("span");
    word.dataset.word = "";
    for (const { segment } of graphemes.segment(part)) {
      const letter = document.createElement("span");
      letter.dataset.letter = "";
      letter.textContent = segment;
      letter.style.setProperty("--i", String(letters.length));
      letters.push(letter);
      word.append(letter);
    }
    box.append(word);
  }
  fxLayer().append(box);
  return { box, letters };
}

/** Waits for the page's whoosh or peel (view transition) to finish, so the letters land on the page itself. */
async function settled() {
  await nextFrame();
  await nextFrame();
  const start = performance.now();
  const busy = () =>
    document.documentElement.hasAttribute("data-flight") || Boolean((document as Document & { activeViewTransition?: unknown }).activeViewTransition);
  while (busy() && performance.now() - start < 2500) await nextFrame();
  await document.fonts?.ready;
}

type Active = { heading: HTMLElement; copy: Copy | null; landing: boolean; stop: () => void };
let active: Active | null = null;
let hovering: { heading: HTMLElement; last: HTMLElement | null; leaving: number } | null = null;

/** Takes the copy away and shows the heading again. */
function finish() {
  if (!active) return;
  const { heading, copy, stop } = active;
  active = null;
  stop();
  delete heading.dataset.lettering;
  copy?.box.remove();
}

/** The letters drop in one at a time and squash on landing (the lab's timings); Calm is a short fade up. */
async function land(heading: HTMLElement) {
  finish();
  if (isReduced()) return;
  if (isCalm()) {
    void anim(heading, [{ opacity: 0, transform: "translateY(8px)" }, { opacity: 1, transform: "none" }], { duration: 260, easing: OUT });
    return;
  }
  heading.dataset.lettering = "hidden";
  const safety = window.setTimeout(finish, SAFETY_MS);
  const entry: Active = { heading, copy: null, landing: true, stop: () => window.clearTimeout(safety) };
  active = entry;
  await settled();
  if (active !== entry) return;
  if (heading.isConnected) entry.copy = copyLetters(heading);
  if (!entry.copy) {
    finish();
    return;
  }
  const wild = isWild();
  const drops = entry.copy.letters.map((letter, i) => {
    const fromY = wild ? rand(-160, -60) : -70;
    const rot = wild ? rand(-40, 40) : 0;
    return anim(
      letter,
      [
        { transform: `translateY(${fromY}px) rotate(${rot}deg)`, opacity: 0 },
        { transform: "translateY(0) scale(1.15, .8)", opacity: 1, offset: 0.65 },
        { transform: "translateY(-6px) scale(.95, 1.06)", offset: 0.82 },
        { transform: "none", opacity: 1 },
      ],
      { duration: 520, delay: i * 38, easing: "ease-in", fill: "backwards" },
    );
  });
  await Promise.all(drops.map((drop) => drop.finished));
  if (active !== entry) return;
  entry.landing = false;
  // A mouse already over it keeps the letters for hopping; otherwise the heading comes back.
  if (hovering?.heading !== heading) finish();
}

/* ----------------------------------------------- Hover: hop and wave ----------------------------------------------- */

/** Lays the letters over the heading at rest, for hopping and waving under a mouse. */
function hoverCopy(heading: HTMLElement) {
  if (active) return active.heading === heading ? active.copy : null;
  const entry: Active = { heading, copy: null, landing: false, stop: () => {} };
  heading.dataset.lettering = "hidden";
  entry.copy = copyLetters(heading);
  if (!entry.copy) {
    delete heading.dataset.lettering;
    return null;
  }
  active = entry;
  return entry.copy;
}

function onMove(event: PointerEvent) {
  if (event.pointerType !== "mouse") return;
  const heading = (event.target as Element).closest<HTMLElement>(HEADING);
  if (!heading || !heading.closest("main") || isCalm()) return;
  if (!hovering || hovering.heading !== heading) {
    hovering = { heading, last: null, leaving: 0 };
  }
  window.clearTimeout(hovering.leaving);
  const copy = hoverCopy(heading);
  if (!copy) return;
  if (isWild()) copy.box.dataset.waving = "";
  const letter = copy.letters.find((candidate) => {
    const r = candidate.getBoundingClientRect();
    return event.clientX >= r.left && event.clientX <= r.right && event.clientY >= r.top - 6 && event.clientY <= r.bottom + 6;
  });
  if (!letter || letter === hovering.last) return;
  hovering.last = letter;
  // Not while it's still landing.
  if (letter.getAnimations().some((animation) => animation.playState === "running")) return;
  void anim(
    letter,
    [{ translate: "0 0", rotate: "0deg" }, { translate: `0 ${-12 * amp()}px`, rotate: `${rand(-8, 8)}deg` }, { translate: "0 0", rotate: "0deg" }],
    { duration: 380, easing: "ease-out" },
  );
}

function onOut(event: PointerEvent) {
  if (!hovering) return;
  const { heading } = hovering;
  if (heading.contains(event.relatedTarget as Node | null)) return;
  const leaving = hovering;
  // Let the last hop finish before the copy goes.
  leaving.leaving = window.setTimeout(() => {
    if (hovering !== leaving) return;
    hovering = null;
    if (active?.heading === heading && !active.landing) finish();
  }, 400);
}

/**
 * Starts watching for page headings to land and for mice over them. Abort the signal to stop. The first
 * page shown (the hard load) doesn't land.
 */
export function installLettering(signal: AbortSignal) {
  let path = location.pathname;
  let arrivedAt = 0;
  let landed = true;
  const main = document.querySelector("main");
  if (!main) return;

  const observer = new MutationObserver((records) => {
    if (location.pathname !== path) {
      path = location.pathname;
      arrivedAt = performance.now();
      landed = false;
    }
    if (landed || performance.now() - arrivedAt > ARRIVAL_MS) return;
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (!(node instanceof HTMLElement)) continue;
        const heading = node.matches(HEADING) ? node : node.querySelector<HTMLElement>(HEADING);
        if (!heading || !heading.closest("[data-page]") || heading.getClientRects().length === 0) continue;
        landed = true;
        void land(heading);
        return;
      }
    }
  });
  observer.observe(main, { childList: true, subtree: true });

  // Scrolling or resizing moves the heading away from its copy (not before the copy exists: the page's
  // own scroll to the top comes in while it waits for the flight).
  const drop = () => {
    if (!active?.copy) return;
    hovering = null;
    finish();
  };
  window.addEventListener("scroll", drop, { signal, passive: true });
  window.addEventListener("resize", drop, { signal, passive: true });
  document.addEventListener("pointermove", onMove, { signal, passive: true });
  document.addEventListener("pointerout", onOut, { signal, passive: true });
  signal.addEventListener("abort", () => {
    observer.disconnect();
    hovering = null;
    finish();
  });
}
