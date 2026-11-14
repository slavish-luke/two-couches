/**
 * Motion on the list (Sprint 26): add flies onto the list, a stamp for watched and a fall for dropped,
 * tabs that deal the cards, stars that cheer. Browser only: call from event handlers and effects. The spec
 * is design/labs/motion-lab.html (scenes `fly`, `stamp`, `deal`, `stars`); timings and keyframes are
 * copied from it, at all three levels, with its reduced-motion alternatives.
 *
 * Nothing here waits for anything: the Server Action starts at the same moment, and anything that must
 * outlive the list's refresh (a card leaving, a poster in flight) moves as a clone in the fx layer
 * (src/lib/fx.ts), which is hidden under reduced motion. So the reduced alternatives work on real elements.
 */
import { fxLayer, sfx, sparkles } from "./fx";
import { amp, anim, center, flyArc, isCalm, isReduced, isWild, OUT, sc, shake, SPRING, wait, type Point } from "./motion";

const inViewport = (r: DOMRect) => r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth;

// ---------------------------------------------------------------------------------------------------------
// Add flies onto the list
// ---------------------------------------------------------------------------------------------------------

/**
 * The List tab: the header's pill nav on wide screens, the tab bar on phones. The one in the layout (the
 * other is display: none), whether or not it's scrolled out of view.
 */
export function listTab(): HTMLElement | null {
  for (const link of document.querySelectorAll<HTMLElement>('a[data-section-link][href="/"]')) {
    if (link.getClientRects().length > 0) return link;
  }
  return null;
}

/** The poster on the card (or Pick's card) a button sits in, if it's on screen. */
function posterFor(el: Element): HTMLImageElement | null {
  const host = el.closest("[data-title-card], article, li");
  const img = host?.querySelector<HTMLImageElement>(".poster-frame img") ?? host?.querySelector<HTMLImageElement>("img");
  return img && inViewport(img.getBoundingClientRect()) ? img : null;
}

/** The List tab swallows what flew in: a squash and stretch, a "+1" sticker, a few sparkles. */
function gulp(tab: HTMLElement) {
  const z = center(tab);
  void anim(
    tab,
    [{ transform: "none" }, { transform: `scale(${sc(1.22)}, ${sc(0.78)})` }, { transform: `scale(${sc(0.92)}, ${sc(1.1)})` }, { transform: "none" }],
    { duration: 460, easing: "ease-out" },
  );
  const plus = document.createElement("div");
  plus.className = "lm-plus";
  plus.textContent = "+1";
  fxLayer().append(plus);
  plus.style.left = `${Math.min(innerWidth - plus.offsetWidth - 4, z.rect.right - plus.offsetWidth / 2 - 4)}px`;
  plus.style.top = `${Math.max(4, z.rect.top - plus.offsetHeight / 2)}px`;
  const lift = isCalm() ? -10 : -22 * amp();
  void anim(
    plus,
    [
      { transform: `scale(0) rotate(${-20 * amp()}deg)`, opacity: 1 },
      { transform: `scale(${sc(1.25)}) rotate(${6 * amp()}deg)`, opacity: 1, offset: 0.3 },
      { transform: "scale(1) rotate(0deg)", opacity: 1, offset: 0.45 },
      { transform: "scale(1) rotate(0deg)", opacity: 1, offset: 0.75 },
      { transform: `translateY(${lift}px) scale(.9)`, opacity: 0 },
    ],
    { duration: 1000, easing: "ease-out" },
  ).finished.then(() => plus.remove());
  if (!isCalm()) sparkles(z.x, z.y, { count: 6, distance: 40 });
}

/**
 * "+ Add": the card's poster jumps out and arcs into the List tab (trailing copies at Wild; a quick straight
 * shrink at Calm), which gulps it. No poster on screen: just the gulp. A List tab scrolled out of view (the
 * header on wide screens): the poster still flies off towards it, with no gulp to see. Reduced motion: the
 * tab flashes. Never awaited by the caller.
 */
export async function flyToList(button: HTMLElement) {
  const tab = listTab();
  const tabShows = tab ? inViewport(tab.getBoundingClientRect()) : false;
  if (isReduced()) {
    if (tab && tabShows) void anim(tab, [{ background: "var(--pop)" }, { background: "transparent" }], { duration: 600 });
    return;
  }
  const img = posterFor(button);
  if (!isCalm()) void anim(button, [{ transform: "none" }, { transform: `scale(${sc(1.12)})` }, { transform: "none" }], { duration: 300, easing: SPRING });
  if (!tab) return;
  const z = center(tab);
  if (img) {
    const a = center(img);
    const src = img.currentSrc || img.src;
    const ghost = (opacity: number) => {
      const g = document.createElement("img");
      g.src = src;
      g.alt = "";
      g.className = "lm-flyer";
      g.style.width = `${a.rect.width}px`;
      g.style.height = `${a.rect.height}px`;
      g.style.opacity = String(opacity);
      g.style.transform = `translate(${a.x}px, ${a.y}px) translate(-50%, -50%)`;
      fxLayer().append(g);
      return g;
    };
    if (isCalm()) {
      const g = ghost(1);
      await flyArc(g, a, z, { lift: 0, duration: 320, scaleTo: 0.12 });
      g.remove();
    } else {
      const trail = isWild() ? [ghost(0.45), ghost(0.25), ghost(0.12)] : [];
      const g = ghost(1);
      sfx("add", a.x, a.y - a.rect.height / 2);
      const go = (el: HTMLElement, delay: number) =>
        wait(delay).then(() => flyArc(el, a, z, { lift: 180 * amp(), duration: 720, scaleTo: 0.14, spin: -25 * amp() }));
      await Promise.all([go(g, 0), ...trail.map((t, i) => go(t, (i + 1) * 45))]);
      g.remove();
      trail.forEach((t) => t.remove());
    }
  }
  if (tabShows) gulp(tab);
}

// ---------------------------------------------------------------------------------------------------------
// A stamp for watched, a fall for dropped
// ---------------------------------------------------------------------------------------------------------

export type LeaveKind = "watched" | "dropped";

/** The rubber stamp: the status word, in the skin's display lettering. Decoration (aria-hidden). */
export function stampElement(word: string, kind: LeaveKind) {
  const mark = document.createElement("span");
  mark.className = "lm-stamp";
  mark.dataset.kind = kind;
  mark.setAttribute("aria-hidden", "true");
  mark.textContent = word;
  return mark;
}

/** The stamp slamming down: from big and blurred to its place in 300 ms. */
export function slam(mark: Element) {
  return anim(
    mark,
    [
      { transform: `scale(${2.6 * Math.max(1, amp() * 0.8)})`, opacity: 0, filter: "blur(3px)" },
      { transform: "scale(.9)", opacity: 1, filter: "blur(0)", offset: 0.75 },
      { transform: "scale(1)", opacity: 1, filter: "blur(0)" },
    ],
    { duration: 300, easing: "ease-in", fill: "forwards" },
  );
}

/** The quiet stamp (Calm): fades in from a touch bigger. Reduced motion: a plain fade. */
export function settleStamp(mark: Element) {
  return isReduced()
    ? anim(mark, [{ opacity: 0 }, { opacity: 1 }], { duration: 250, fill: "forwards" })
    : anim(mark, [{ opacity: 0, transform: "scale(1.1)" }, { opacity: 1, transform: "scale(1)" }], { duration: 220, fill: "forwards", easing: OUT });
}

/** A copy of a list card in the fx layer, exactly over it (tilt included), so it can leave while the list refreshes. */
function ghostOf(card: HTMLElement) {
  const rect = card.getBoundingClientRect();
  const ghost = card.cloneNode(true) as HTMLElement;
  ghost.removeAttribute("id");
  ghost.querySelectorAll("[id]").forEach((el) => el.removeAttribute("id"));
  ghost.setAttribute("inert", "");
  ghost.style.left = `${rect.left}px`;
  ghost.style.top = `${rect.top}px`;
  ghost.style.width = `${rect.width}px`;
  ghost.style.height = `${rect.height}px`;
  ghost.style.margin = "0";
  const row = card.closest(".tilt-row");
  if (row) ghost.style.rotate = getComputedStyle(row).rotate;
  fxLayer().append(ghost);
  return ghost;
}

/**
 * Notes where focus should go if a card leaves with it (the next card's title, else the one before, else
 * `fallback`); call the result once the save is done, and focus moves there when the refreshed list drops
 * the card. Read at the tap, before anything changes.
 */
function focusAfterLeaving(card: HTMLElement, fallback: HTMLElement | null) {
  const row = card.closest("li");
  const next = (row?.nextElementSibling ?? row?.previousElementSibling)?.querySelector<HTMLElement>("[data-item-title]") ?? null;
  const target = next ?? fallback;
  const had = card.contains(document.activeElement);
  return () => {
    const started = performance.now();
    const check = () => {
      if (card.isConnected && performance.now() - started < 4000) return void requestAnimationFrame(check);
      const active = document.activeElement;
      if (had && target?.isConnected && (!active || active === document.body || !active.isConnected)) target.focus({ preventScroll: true });
    };
    requestAnimationFrame(check);
  };
}

/**
 * A Home list card leaving Up next. Watched: the stamp slams on (Calm: settles; reduced: fades), the card
 * squashes, the list jolts, and at Lively and Wild the card slides off into the Watched tab. Dropped: it
 * tips over the edge and falls off the bottom (Calm and reduced: it fades out).
 *
 * Call `done(ok)` when the save has finished. A failed save puts the card back as it was. The card's focus
 * moves to its neighbour once the refreshed list no longer has it.
 */
export function leaveList(card: HTMLElement, kind: LeaveKind, word: string, watchedTab: HTMLElement | null) {
  const list = card.closest("ul") ?? card;
  const keepFocus = focusAfterLeaving(card, watchedTab);
  const undo: (() => void)[] = [];
  const result = { ok: null as boolean | null };
  const failed = () => result.ok === false;

  // Reduced motion: everything happens on the real card (the fx layer is hidden), which the refresh removes.
  if (isReduced()) {
    if (kind === "watched") {
      const mark = stampElement(word, kind);
      card.append(mark);
      card.classList.add("lm-done");
      const a = settleStamp(mark);
      undo.push(() => (a.cancel(), mark.remove(), card.classList.remove("lm-done")));
    } else {
      const a = anim(card, [{ opacity: 1 }, { opacity: 0 }], { duration: 220, fill: "forwards" });
      undo.push(() => a.cancel());
    }
    return {
      done(ok: boolean) {
        if (ok) keepFocus();
        else undo.forEach((u) => u());
      },
    };
  }

  const ghost = ghostOf(card);
  card.style.opacity = "0";
  const restore = () => {
    card.style.opacity = "";
    ghost.remove();
  };
  const c = center(card);

  const run = async () => {
    // Calm: the stamp settles on (or the card fades down and out), holds a moment, and the copy goes.
    if (isCalm()) {
      if (kind === "watched") {
        const mark = stampElement(word, kind);
        ghost.append(mark);
        ghost.classList.add("lm-done");
        await settleStamp(mark).finished;
        await wait(550);
      }
      await anim(ghost, kind === "watched" ? [{ opacity: 1 }, { opacity: 0 }] : [{ opacity: 1 }, { opacity: 0, transform: "translateY(10px)" }], {
        duration: kind === "watched" ? 200 : 220,
        fill: "forwards",
      }).finished;
      ghost.remove();
      return;
    }
    if (kind === "watched") {
      const mark = stampElement(word, kind);
      ghost.append(mark);
      await slam(mark).finished;
      if (failed()) return;
      ghost.classList.add("lm-done");
      void anim(ghost, [{ transform: "none" }, { transform: `scale(${sc(1.03)}, ${sc(0.93)})` }, { transform: "none" }], { duration: 240, easing: "ease-out" });
      // The list jolts; clipped sideways meanwhile, as its tilted cards would poke past the screen's edge.
      const unclip = clipSideways([list]);
      void (shake(list, 5)?.finished ?? Promise.resolve()).then(unclip);
      const m = center(mark);
      sfx("stamp", m.x, m.y - 50);
      if (isWild()) sparkles(m.x, m.y, { count: 10, colors: ["var(--accent)"], distance: 80 });
      await wait(700);
      if (failed()) return;
      const to: Point = watchedTab ? center(watchedTab) : { x: c.x, y: -60 };
      const from = center(ghost);
      await anim(
        ghost,
        [
          { transform: "none", opacity: 1 },
          { transform: `translate(${to.x - from.x}px, ${to.y - from.y}px) scale(.2) rotate(8deg)`, opacity: 0 },
        ],
        { duration: 520, easing: "cubic-bezier(.5,0,.75,0)", fill: "forwards" },
      ).finished;
      ghost.remove();
      if (watchedTab?.isConnected && !failed()) {
        void anim(watchedTab, [{ transform: "none" }, { transform: `scale(${sc(1.15)}) rotate(-3deg)` }, { transform: "none" }], { duration: 380, easing: SPRING });
        const count = watchedTab.querySelector("[data-deal-count]");
        if (count) void anim(count, [{ transform: "scale(1.6)" }, { transform: "none" }], { duration: 300, easing: SPRING });
      }
    } else {
      ghost.style.transformOrigin = "0% 100%";
      const a = amp();
      await anim(
        ghost,
        [{ transform: "none" }, { transform: `rotate(${6 * a}deg)`, offset: 0.3 }, { transform: `rotate(${3 * a}deg)`, offset: 0.45 }, { transform: `rotate(${9 * a}deg)` }],
        { duration: 520, easing: "ease-in-out", fill: "forwards" },
      ).finished;
      if (failed()) return;
      void anim(
        ghost,
        [{ transform: `rotate(${9 * a}deg)` }, { transform: `translate(${30 * a}px, 420px) rotate(${55 * a}deg)`, opacity: 1 }],
        { duration: 650, easing: "cubic-bezier(.55,0,1,.45)", fill: "forwards" },
      ).finished.then(() => ghost.remove());
      await wait(420);
      const floor = Math.min(innerHeight - 40, c.y + 220);
      sfx("drop", c.x, floor);
      if (isWild()) sparkles(c.x, floor + 30, { count: 10, colors: ["var(--muted)"], distance: 50 });
    }
  };
  void run();

  return {
    done(ok: boolean) {
      result.ok = ok;
      if (!ok) return restore();
      keepFocus();
      // If the refreshed list still has the card (it shouldn't), show it again once the ghost has gone.
      void wait(2600).then(() => {
        if (card.isConnected) card.style.opacity = "";
      });
    },
  };
}

/** The title page's version: no list to leave, so the stamp slams onto the panel, holds, and lifts off (dropped: tips off). */
export async function stampPanel(mark: HTMLElement, panel: HTMLElement, kind: LeaveKind) {
  if (isCalm()) {
    await settleStamp(mark).finished;
    await wait(1100);
    await anim(mark, [{ opacity: 1 }, { opacity: 0 }], { duration: 300, fill: "forwards" }).finished;
    return;
  }
  await slam(mark).finished;
  if (!mark.isConnected) return;
  shake(panel, 5);
  const m = center(mark);
  sfx(kind === "watched" ? "stamp" : "drop", m.x, m.y - 50);
  if (isWild()) sparkles(m.x, m.y, { count: 10, colors: [kind === "watched" ? "var(--accent)" : "var(--danger)"], distance: 80 });
  await wait(kind === "watched" ? 1000 : 500);
  const a = amp();
  await anim(
    mark,
    kind === "watched"
      ? [{ transform: "scale(1)", opacity: 1 }, { transform: "scale(1.08)", opacity: 0 }]
      : [
          { transform: "none", opacity: 1 },
          { transform: `rotate(${6 * a}deg)`, opacity: 1, offset: 0.3 },
          { transform: `rotate(${3 * a}deg)`, opacity: 1, offset: 0.45 },
          { transform: `translateY(${40 * a}px) rotate(${25 * a}deg)`, opacity: 0 },
        ],
    { duration: kind === "watched" ? 300 : 700, easing: "ease-in", fill: "forwards" },
  ).finished;
}

// ---------------------------------------------------------------------------------------------------------
// Tabs that deal the cards
// ---------------------------------------------------------------------------------------------------------

/** What a tab deals: Home's list cards and the poster cards (Browse, Coming soon). */
const CARDS = "[data-list-card], [data-title-card]";
/** Cards past this many (in page order) aren't dealt: they're off screen or far down. */
const DEAL_CAP = 12;
/** How long after a tab press the new list's first paint still deals (Suspense reveals included). */
const DEAL_WINDOW_MS = 8000;

type Pending = { to: string; at: number; flicks: Animation[]; dealt: WeakSet<Element>; restoreTimer: number };
const pending = new Map<string, Pending>();
const containers = new Map<string, Set<HTMLElement>>();
let listening = 0;

/** The element that moves: the list row around a Home card, or the poster card itself. */
const mover = (card: Element) => (card.matches("[data-list-card]") ? (card.closest("li") ?? card) : card) as HTMLElement;

/** Cards across the screen's width, in page order, at most DEAL_CAP. */
function cardsIn(root: HTMLElement, skip?: WeakSet<Element>) {
  const out: HTMLElement[] = [];
  for (const card of root.querySelectorAll(CARDS)) {
    const el = mover(card);
    if (skip?.has(el) || out.includes(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.right <= 0 || r.left >= innerWidth) continue;
    out.push(el);
    if (out.length >= DEAL_CAP) break;
  }
  return out;
}

/**
 * Clips a list sideways while its cards fly in from the side, so they never widen the page. Scrolling rows
 * already clip. Returns the undo.
 */
const clips = new WeakMap<HTMLElement, number>();
function clipSideways(els: HTMLElement[]) {
  const parents = [...new Set(els.map((el) => el.parentElement).filter((p): p is HTMLElement => !!p))].filter(
    (p) => clips.has(p) || !/(auto|scroll|hidden|clip)/.test(getComputedStyle(p).overflowX),
  );
  for (const p of parents) {
    clips.set(p, (clips.get(p) ?? 0) + 1);
    p.classList.add("lm-dealing");
  }
  let undone = false;
  return () => {
    if (undone) return;
    undone = true;
    for (const p of parents) {
      const n = (clips.get(p) ?? 1) - 1;
      if (n > 0) clips.set(p, n);
      else {
        clips.delete(p);
        p.classList.remove("lm-dealing");
      }
    }
  };
}

/** In the capture phase: Next's Link cancels the click's default before a bubbling listener would see it. */
function onTabClick(event: MouseEvent) {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  const link = (event.target as Element | null)?.closest<HTMLElement>("a[data-deal-tab]");
  const scope = link?.dataset.dealTab;
  const to = link?.dataset.dealTo;
  if (!link || !scope || !to || link.getAttribute("aria-current") === "page" || !containers.get(scope)?.size) return;
  pressTab(scope, to, link);
}

/** A tab press: remember it for the new list's first paint, jiggle the tab and its count, flick the old cards away. */
function pressTab(scope: string, to: string, link: HTMLElement) {
  const old = pending.get(scope);
  if (old) clearTimeout(old.restoreTimer);
  const p: Pending = { to, at: performance.now(), flicks: [], dealt: new WeakSet(), restoreTimer: 0 };
  pending.set(scope, p);
  if (isReduced()) return;

  void anim(
    link,
    [{ transform: "none" }, { transform: `rotate(${-5 * amp()}deg) scale(${sc(1.08)})` }, { transform: `rotate(${3 * amp()}deg)` }, { transform: "none" }],
    { duration: 380, easing: "ease-out" },
  );
  const count = link.querySelector("[data-deal-count]");
  if (count) void anim(count, [{ transform: "none" }, { transform: `translateY(${-8 * amp()}px) scale(${sc(1.3)})` }, { transform: "none" }], { duration: 400, easing: SPRING });

  const oldCards = [...new Set([...(containers.get(scope) ?? [])].flatMap((root) => cardsIn(root)))];
  if (!oldCards.length) return;
  const unclip = clipSideways(oldCards);
  window.setTimeout(unclip, 260 + oldCards.length * 35);
  p.flicks = oldCards.map((el, i) =>
    isCalm()
      ? anim(el, [{ opacity: 1 }, { opacity: 0, transform: "translateX(-8px)" }], { duration: 120, fill: "forwards" })
      : anim(
          el,
          [{ transform: "none", opacity: 1 }, { transform: `translate(${-70 * amp()}px, ${10 * amp()}px) rotate(${-8 * amp()}deg)`, opacity: 0 }],
          { duration: 200, delay: i * 35, easing: "ease-in", fill: "forwards" },
        ),
  );
  // The new list is slow to come (a cold cache): bring the old cards back, dimmed, rather than an empty space.
  p.restoreTimer = window.setTimeout(() => {
    if (pending.get(scope) !== p) return;
    p.flicks.forEach((a) => a.cancel());
    p.flicks = oldCards.filter((el) => el.isConnected).map((el) => anim(el, [{ opacity: 0 }, { opacity: 0.45 }], { duration: 200, fill: "forwards" }));
  }, 450);
}

/** Registers a dealing list (a DealIn anchor's parent). Returns the unregister. */
export function watchTabs(scope: string, root: HTMLElement) {
  if (!containers.has(scope)) containers.set(scope, new Set());
  containers.get(scope)!.add(root);
  if (listening++ === 0) document.addEventListener("click", onTabClick, true);
  return () => {
    containers.get(scope)?.delete(root);
    if (--listening === 0) document.removeEventListener("click", onTabClick, true);
  };
}

/**
 * The new list's first paint after a tab press (call from a layout effect): its cards deal in from the side,
 * one after another (Calm: a quick slide; reduced: a fade). Only for a press of the tab now showing, within
 * DEAL_WINDOW_MS; refreshes and other filters never deal.
 */
export function dealIfPressed(scope: string, tab: string, root: HTMLElement) {
  const p = pending.get(scope);
  if (!p || p.to !== tab || performance.now() - p.at > DEAL_WINDOW_MS) return;
  clearTimeout(p.restoreTimer);
  p.flicks.forEach((a) => a.cancel());
  p.flicks = [];
  const cards = cardsIn(root, p.dealt);
  cards.forEach((el) => p.dealt.add(el));
  if (!cards.length) return;
  if (isReduced()) {
    cards.forEach((el) => void anim(el, [{ opacity: 0 }, { opacity: 1 }], { duration: 200 }));
    return;
  }
  const unclip = clipSideways(cards);
  const runs = cards.map((el, i) =>
    isCalm()
      ? anim(el, [{ opacity: 0, transform: "translateX(8px)" }, { opacity: 1, transform: "none" }], { duration: 180, easing: OUT })
      : anim(
          el,
          [{ transform: `translate(${160 * amp()}px, ${-30 * amp()}px) rotate(${14 * amp()}deg)`, opacity: 0 }, { transform: "none", opacity: 1 }],
          { duration: 460, delay: i * 75, easing: SPRING, fill: "backwards" },
        ),
  );
  void Promise.all(runs.map((a) => a.finished)).then(unclip);
}

// ---------------------------------------------------------------------------------------------------------
// Stars that cheer
// ---------------------------------------------------------------------------------------------------------

/**
 * Your stars after a choice: each one up to `rating` pops in turn, ones that went out shrink back, and five
 * stars burst into sparkles (with "WOW!" in POW!) and, at Wild, do a wave. `stars` are the elements that pop
 * (inside the buttons), `buttons` the ones that wave. Nothing under reduced motion.
 */
export function cheerStars(stars: HTMLElement[], buttons: HTMLElement[], rating: number, was: number) {
  if (isReduced()) return;
  stars.forEach((star, i) => {
    if (i < rating) {
      void anim(
        star,
        [{ transform: "scale(.5) rotate(0deg)" }, { transform: `scale(${sc(1.35)}) rotate(${-18 * amp()}deg)` }, { transform: "none" }],
        { duration: 420, delay: i * (isCalm() ? 0 : 55), easing: "ease-out", fill: "backwards" },
      );
    } else if (i < was) {
      void anim(star, [{ transform: "scale(1)" }, { transform: "scale(.7)" }, { transform: "none" }], { duration: 200 });
    }
  });
  if (rating === 5 && !isCalm()) {
    void wait(300).then(() => {
      const first = stars[0]?.getBoundingClientRect();
      const last = stars[4]?.getBoundingClientRect();
      if (!first || !last || !stars[0].isConnected) return;
      const x = (first.left + last.right) / 2;
      const y = (first.top + last.bottom) / 2;
      sparkles(x, y, { count: 14, distance: 110 });
      sfx("five", x, y - 50);
      if (isWild()) {
        buttons.forEach((b, i) => void anim(b, [{ transform: "none" }, { transform: "translateY(-12px)" }, { transform: "none" }], { duration: 380, delay: i * 60, easing: "ease-in-out" }));
      }
    });
  }
}

/** Your partner's stars arriving live: they drop in one after another (reduced motion: they fade in). */
export function dropInStars(stars: Element[], rating: number) {
  stars.slice(0, rating).forEach((star, i) => {
    if (isReduced()) return void anim(star, [{ opacity: 0 }, { opacity: 1 }], { duration: 200 });
    void anim(
      star,
      [
        { transform: `translateY(${-50 * Math.max(0.4, amp())}px) rotate(-30deg)`, opacity: 0 },
        { transform: "translateY(4px) scaleY(.8)", opacity: 1, offset: 0.7 },
        { transform: "none", opacity: 1 },
      ],
      { duration: isCalm() ? 200 : 420, easing: "ease-in", fill: "backwards", delay: i * (isCalm() ? 20 : 80) },
    );
  });
}

/** How long a dropInStars() of `rating` stars takes to land (the verdict waits for it). */
export function starsLandMs(rating: number) {
  return isReduced() ? 0 : rating * (isCalm() ? 20 : 80) + (isCalm() ? 200 : 420);
}

export type Verdict = "same" | "close" | "split";

export function verdictFor(mine: number | null | undefined, theirs: number | null | undefined): Verdict | null {
  if (!mine || !theirs) return null;
  const d = Math.abs(mine - theirs);
  return d === 0 ? "same" : d === 1 ? "close" : "split";
}

/**
 * The verdict sticker landing: "Same!" is slapped on (a small jolt of `host`, sparkles, "BINGO!" in POW!),
 * "Close!" and "Ooh, a split" pop on with a wobble. Reduced motion: a fade.
 */
export async function landVerdict(sticker: HTMLElement, verdict: Verdict, host: HTMLElement | null, delay = 0) {
  if (isReduced()) return void anim(sticker, [{ opacity: 0 }, { opacity: 1 }], { duration: 200, delay, fill: "backwards" });
  if (verdict === "same") {
    void anim(
      sticker,
      [
        { transform: "scale(2.4) rotate(20deg)", opacity: 0 },
        { transform: "scale(.92) rotate(-2deg)", opacity: 1, offset: 0.65 },
        { transform: "scale(1) rotate(0deg)", opacity: 1 },
      ],
      { duration: isCalm() ? 220 : 380, delay, easing: "ease-in", fill: "backwards" },
    );
    await wait(delay + 250);
    if (!sticker.isConnected || isCalm()) return;
    if (host) shake(host, 7);
    const c = center(sticker);
    sparkles(c.x, c.y, { count: 14, distance: 90 });
    sfx("same", c.x, c.y - 60);
  } else {
    void anim(
      sticker,
      isCalm()
        ? [{ transform: "scale(.8)", opacity: 0 }, { transform: "scale(1)", opacity: 1 }]
        : [
            { transform: "scale(0) rotate(0deg)", opacity: 0 },
            { transform: "scale(1.1) rotate(4deg)", opacity: 1, offset: 0.6 },
            { transform: "scale(1) rotate(-3deg)", opacity: 1, offset: 0.8 },
            { transform: "scale(1) rotate(2deg)", opacity: 1 },
          ],
      { duration: isCalm() ? 200 : 520, delay, easing: "ease-out", fill: "backwards" },
    );
  }
}
