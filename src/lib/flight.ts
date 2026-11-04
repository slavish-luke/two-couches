/**
 * Page transitions, in the browser: forward is a "whoosh" (the old page skids off, the new one skids in),
 * back is a "peel" (the old page peels away to the right like a sheet, the earlier one rises underneath).
 * Sections skipped in the nav on the way riffle past as lightweight previews, and the speed lines get
 * stronger with distance. Driven by the transition types on nav links (flightTypes()); browser back and
 * forward are told apart with the Navigation API (popstate counts as back where it's missing). Only
 * transform and opacity animate. Nothing runs with reduced motion.
 */

/** The old and new page's view-transition pseudo-elements, as React hands them to a <ViewTransition>. */
type Pseudo = { animate(keyframes: Keyframe[], options: KeyframeAnimationOptions): Animation };
export type TransitionInstance = { old: Pseudo; new: Pseudo };

type Plan = { kind: "whoosh" | "peel"; passed: number[] };

/** The transition types for going from one nav section to another (indices into the nav's sections). */
export function flightTypes(from: number, to: number): string[] {
  if (from < 0 || from === to) return ["whoosh"];
  const step = to > from ? 1 : -1;
  const passed: string[] = [];
  for (let k = from + step; k !== to; k += step) passed.push(`pass-${k}`);
  return [to > from ? "whoosh" : "peel", ...passed];
}

let traverse = { at: -Infinity, back: true };
let scrollBefore = 0;
let deck: HTMLElement | null = null;

if (typeof window !== "undefined") {
  type NavigateEvent = Event & { navigationType: string; destination: { index: number } };
  const navigation = (window as Window & { navigation?: EventTarget & { currentEntry: { index: number } | null } }).navigation;
  if (navigation) {
    navigation.addEventListener("navigate", (event) => {
      const { navigationType, destination } = event as NavigateEvent;
      scrollBefore = window.scrollY;
      if (navigationType === "traverse") {
        traverse = { at: performance.now(), back: destination.index < (navigation.currentEntry?.index ?? 0) };
      }
    });
  } else {
    window.addEventListener("popstate", () => (traverse = { at: performance.now(), back: true }));
    window.addEventListener("click", () => (scrollBefore = window.scrollY), { capture: true });
  }
}

/** The flight layer (<FlightDeck>), which holds the speed lines and the previews of passed sections. */
export function registerDeck(element: HTMLElement | null) {
  deck = element;
}

function planFor(types: string[]): Plan | null {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return null;
  const passed = types.filter((type) => type.startsWith("pass-")).map((type) => Number(type.slice(5)));
  if (types.includes("peel")) return { kind: "peel", passed };
  if (types.includes("whoosh")) return { kind: "whoosh", passed };
  // Browser back and forward carry no types.
  if (performance.now() - traverse.at < 1500) return { kind: traverse.back ? "peel" : "whoosh", passed: [] };
  return { kind: "whoosh", passed: [] };
}

const STEP = { whoosh: 75, peel: 80 };

/**
 * Marks the flight on <html> for its duration: globals.css stacks the pages and the flight layer by it
 * (the old sheet on top when peeling) and draws the peeling sheet's paper.
 */
function mark(kind: Plan["kind"]) {
  document.documentElement.dataset.flight = kind;
  return () => delete document.documentElement.dataset.flight;
}

/** The page being left. */
export function flightOut(instance: TransitionInstance, types: string[]) {
  const plan = planFor(types);
  if (!plan) return;
  if (plan.kind === "whoosh") {
    const out = instance.old.animate(
      [
        { transform: "none", opacity: 1 },
        { transform: "translateX(-55%) skewX(9deg)", opacity: 0 },
      ],
      { duration: 260, easing: "cubic-bezier(.55,0,.85,.35)", fill: "forwards" },
    );
    return () => out.cancel();
  }
  // Line the sheet's rays up with the screen's: it was captured where the page sat before the swap.
  const page = document.querySelector<HTMLElement>("[data-page]");
  if (page) {
    const top = page.getBoundingClientRect().top + window.scrollY - scrollBefore;
    const left = page.getBoundingClientRect().left;
    document.documentElement.style.setProperty("--sheet-x", `calc(50vw - ${left}px)`);
    document.documentElement.style.setProperty("--sheet-y", `calc(-10vh - ${top}px)`);
  }
  const unmark = mark("peel");
  const animations = [
    instance.old.animate(
      [
        { transform: "none" },
        { transform: "translateX(-1.5%) rotate(-.4deg)", offset: 0.15 },
        { transform: "translateX(112%) rotate(3deg)" },
      ],
      { duration: plan.passed.length ? 300 : 360, easing: "cubic-bezier(.5,0,.75,.4)", fill: "forwards" },
    ),
  ];
  return () => {
    animations.forEach((animation) => animation.cancel());
    unmark();
  };
}

/** The page arriving, the flight layer and the passed sections. */
export function flightIn(instance: TransitionInstance, types: string[]) {
  const plan = planFor(types);
  if (!plan) return;
  const n = plan.passed.length;
  const unmark = mark(plan.kind);
  const animations: Animation[] = [];

  if (plan.kind === "whoosh") {
    animations.push(
      instance.new.animate(
        [
          { transform: "translateX(45%) skewX(-9deg)", opacity: 0 },
          { opacity: 1, offset: 0.35 },
          { transform: "none", opacity: 1 },
        ],
        { duration: 440, delay: n ? 90 + STEP.whoosh * n : 70, easing: "cubic-bezier(.22,1.2,.36,1)", fill: "both" },
      ),
    );
  } else {
    animations.push(
      instance.new.animate(
        [
          { transform: "translateX(-3%) scale(.965)", opacity: 0.85 },
          { transform: "none", opacity: 1 },
        ],
        { duration: 460 + STEP.peel * n, easing: "cubic-bezier(.2,.9,.3,1)", fill: "both" },
      ),
    );
  }
  animations.push(...flyDeck(plan));
  return () => {
    animations.forEach((animation) => animation.cancel());
    unmark();
  };
}

/** Speed lines across the screen, and the passed sections riffling by (whoosh) or peeling off (peel). */
function flyDeck({ kind, passed }: Plan): Animation[] {
  if (!deck) return [];
  const n = passed.length;
  const animations: Animation[] = [];

  const lines = deck.querySelector<HTMLElement>("[data-speed-lines]");
  if (lines && kind === "whoosh") {
    lines.dataset.strong = n ? "true" : "false";
    animations.push(
      lines.animate(
        [
          { opacity: 0, transform: "translateX(40%) scaleX(1.6)" },
          { opacity: 1, offset: 0.3 },
          { opacity: 0, transform: "translateX(-40%) scaleX(1)" },
        ],
        { duration: 380 + 90 * n, easing: "ease-out" },
      ),
    );
  }

  passed.forEach((section, j) => {
    const ghost = deck?.querySelector<HTMLElement>(`[data-section="${section}"]`);
    if (!ghost) return;
    // Nearest the old page on top when peeling.
    ghost.style.zIndex = String(n - j);
    animations.push(
      kind === "whoosh"
        ? ghost.animate(
            [
              { transform: "translateX(70%) skewX(-8deg)", opacity: 0 },
              { transform: "translateX(10%) skewX(-3deg)", opacity: 1, offset: 0.4 },
              { transform: "translateX(-60%) skewX(8deg)", opacity: 0 },
            ],
            { duration: 240, delay: 90 + STEP.whoosh * j, easing: "cubic-bezier(.45,.05,.55,.95)", fill: "both" },
          )
        : ghost.animate(
            [
              { transform: "none", opacity: 1 },
              { transform: "translateX(-1.5%) rotate(-.4deg)", opacity: 1, offset: 0.15 },
              { transform: "translateX(112%) rotate(3deg)", opacity: 1 },
            ],
            { duration: 300, delay: STEP.peel * (j + 1), easing: "cubic-bezier(.5,0,.75,.4)", fill: "both" },
          ),
    );
  });
  return animations;
}
