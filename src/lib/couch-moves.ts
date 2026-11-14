/**
 * The couches' moves (Sprint 27), copied from design/labs/motion-lab.html (scenes "heart", "ready" and
 * "idle"). Browser only. Each takes a couch's <svg class="couch"> (src/components/couch.tsx) and animates its
 * inner parts with WAAPI (couch-body, couch-look, couch-mouth, couch-cheek, couch-yawn, couch-doze-z), so the
 * svg's own bob and blink (CSS) carry on underneath. Everything scales with the Motion level through amp() and
 * sc(); callers skip them under reduced motion (amp() is 0 there, so they would barely move anyway).
 */
import { amp, anim, center, sc, wait } from "./motion";
import { sparkles } from "./fx";

type CouchEl = Element;

const part = (couch: CouchEl, name: string) => couch.querySelector<SVGElement>(`.${name}`);
const parts = (couch: CouchEl, name: string) => [...couch.querySelectorAll<SVGElement>(`.${name}`)];

/** True while any of this couch's parts is mid-move, so two moves never fight over one couch. */
export function isMoving(couch: CouchEl): boolean {
  return [part(couch, "couch-body"), ...parts(couch, "couch-look"), part(couch, "couch-yawn")].some(
    (el) => el && el.getAnimations().some((a) => a.playState === "running"),
  );
}

/** Catching something: squash, hop, land (the lab's heart scene, `catchIt`). */
export function hop(couch: CouchEl): Promise<unknown> {
  const body = part(couch, "couch-body");
  if (!body) return Promise.resolve();
  return anim(
    body,
    [
      { transform: "none" },
      { transform: `scale(${sc(1.12)}, ${sc(0.86)})` },
      { transform: `translateY(${-18 * amp()}px) scale(${sc(0.92)}, ${sc(1.1)})` },
      { transform: `scale(${sc(1.08)}, ${sc(0.92)})` },
      { transform: "none" },
    ],
    { duration: 620, easing: "ease-out" },
  ).finished;
}

/** Throwing something: a quick squash and lift (the sender's couch). */
export function launch(couch: CouchEl): Promise<unknown> {
  const body = part(couch, "couch-body");
  if (!body) return Promise.resolve();
  return anim(
    body,
    [{ transform: "none" }, { transform: `scale(${sc(1.1)}, ${sc(0.88)})` }, { transform: `translateY(${-8 * amp()}px)` }, { transform: "none" }],
    { duration: 380, easing: "ease-out" },
  ).finished;
}

/** Springing up when you say you're ready (the lab's ready scene). Shorter at Calm. */
export function spring(couch: CouchEl, calm: boolean): Promise<unknown> {
  const body = part(couch, "couch-body");
  if (!body) return Promise.resolve();
  return anim(
    body,
    [
      { transform: "none" },
      { transform: `scale(${sc(1.12)}, ${sc(0.85)})`, offset: 0.15 },
      { transform: `translateY(${-26 * amp()}px) scale(${sc(0.92)}, ${sc(1.1)})`, offset: 0.45 },
      { transform: `scale(${sc(1.12)}, ${sc(0.88)})`, offset: 0.75 },
      { transform: "none" },
    ],
    { duration: calm ? 300 : 620, easing: "ease-out" },
  ).finished;
}

/** Cheeks glowing for a moment. */
export function blush(couch: CouchEl, duration = 1200) {
  for (const cheek of parts(couch, "couch-cheek")) {
    void anim(
      cheek,
      [
        { opacity: 1, transform: "scale(1)" },
        { opacity: 1, transform: "scale(1.6)", filter: "saturate(2)" },
        { opacity: 1, transform: "scale(1)" },
      ],
      { duration },
    );
  }
}

// ---------------------------------------------------------------------------------------------------------
// Idle moves (the lab's "Couches with a life of their own"): `me` is the left couch, `pt` the right one.
// ---------------------------------------------------------------------------------------------------------

export const IDLE_MOVES = ["glance", "yawn", "nudge", "hi5", "doze"] as const;
export type IdleMove = (typeof IDLE_MOVES)[number];

/** Eyes slide towards each other; the left couch blushes. `translate`, so the eyes keep blinking. */
async function glance(me: CouchEl, pt: CouchEl) {
  const d = 2.5 * Math.max(0.6, amp());
  const look = (couch: CouchEl, dx: number, at: number) =>
    parts(couch, "couch-look").map(
      (eye) =>
        anim(eye, [{ translate: "0 0" }, { translate: `${dx}px 0`, offset: at }, { translate: `${dx}px 0`, offset: 0.8 }, { translate: "0 0" }], {
          duration: 1400,
        }).finished,
    );
  blush(me, 1400);
  await Promise.all([...look(me, d, 0.2), ...look(pt, -d, 0.25)]);
}

/** One couch yawns: mouth opens wide, eyes squeeze, the body stretches. */
async function yawn(couch: CouchEl) {
  const mouth = part(couch, "couch-mouth");
  const open = part(couch, "couch-yawn");
  const body = part(couch, "couch-body");
  const squeeze = (eye: SVGElement) =>
    anim(eye, [{ scale: "1 1" }, { scale: "1 .2", offset: 0.3 }, { scale: "1 .2", offset: 0.75 }, { scale: "1 1" }], { duration: 1500 }).finished;
  await Promise.all([
    open &&
      anim(
        open,
        [
          { opacity: 0, transform: "scale(.5)" },
          { opacity: 1, transform: `scale(1, ${1.6 * Math.max(0.7, amp())})`, offset: 0.4 },
          { opacity: 1, offset: 0.7 },
          { opacity: 0 },
        ],
        { duration: 1500 },
      ).finished,
    mouth && anim(mouth, [{ opacity: 1 }, { opacity: 0, offset: 0.1 }, { opacity: 0, offset: 0.8 }, { opacity: 1 }], { duration: 1500 }).finished,
    ...parts(couch, "couch-look").map(squeeze),
    body && anim(body, [{ transform: "none" }, { transform: `scale(${sc(0.96)}, ${sc(1.08)})`, offset: 0.4 }, { transform: "none" }], { duration: 1500 }).finished,
  ]);
}

/** The left couch leans into the right one, which rocks. */
async function nudge(me: CouchEl, pt: CouchEl) {
  const a = amp();
  const mine = part(me, "couch-body");
  const theirs = part(pt, "couch-body");
  if (mine) await anim(mine, [{ transform: "none" }, { transform: `translateX(${8 * a}px) rotate(${10 * a}deg)`, offset: 0.4 }, { transform: "none" }], { duration: 600, easing: "ease-in-out" }).finished;
  if (theirs)
    await anim(theirs, [{ transform: "none" }, { transform: `translateX(${6 * a}px) rotate(${8 * a}deg)` }, { transform: `rotate(${-4 * a}deg)` }, { transform: "none" }], {
      duration: 500,
      easing: "ease-out",
    }).finished;
}

/** Both lean in and meet in the middle with a burst of sparkles. The lean is capped, as Home's couches sit far apart. */
async function hi5(me: CouchEl, pt: CouchEl) {
  const gap = Math.min(28, (pt.getBoundingClientRect().left - me.getBoundingClientRect().right) / 2);
  const lean = (couch: CouchEl, dir: number) => {
    const body = part(couch, "couch-body");
    if (!body) return Promise.resolve();
    return anim(
      body,
      [
        { transform: "none" },
        { transform: `translateX(${dir * gap * 0.8}px) rotate(${dir * 14}deg)`, offset: 0.45 },
        { transform: `translateX(${dir * gap * 0.8}px) rotate(${dir * 8}deg)`, offset: 0.6 },
        { transform: "none" },
      ],
      { duration: 800, easing: "ease-in-out" },
    ).finished;
  };
  const both = Promise.all([lean(me, 1), lean(pt, -1)]);
  await wait(360);
  const c1 = center(me);
  const c2 = center(pt);
  sparkles((c1.x + c2.x) / 2, c1.y - 20, { count: 10, distance: 50 });
  await both;
}

/** One couch nods off for three seconds, with Zs. */
async function doze(couch: CouchEl) {
  const z = part(couch, "couch-doze-z") ?? part(couch, "couch-z");
  const body = part(couch, "couch-body");
  await Promise.all([
    ...parts(couch, "couch-look").map(
      (eye) => anim(eye, [{ scale: "1 1" }, { scale: "1 .12", offset: 0.15 }, { scale: "1 .12", offset: 0.9 }, { scale: "1 1" }], { duration: 3000 }).finished,
    ),
    z &&
      anim(
        z,
        [
          { opacity: 0, transform: "translate(0,0)" },
          { opacity: 1, transform: "translate(2px,-4px)", offset: 0.3 },
          { opacity: 1, transform: "translate(4px,-10px)", offset: 0.7 },
          { opacity: 0, transform: "translate(6px,-16px)" },
        ],
        { duration: 3000 },
      ).finished,
    body &&
      anim(
        body,
        [{ transform: "none" }, { transform: "rotate(-4deg) translateY(1px)", offset: 0.3 }, { transform: "rotate(-4deg) translateY(1px)", offset: 0.85 }, { transform: "none" }],
        { duration: 3000 },
      ).finished,
  ]);
}

/**
 * Plays one idle move on a pair of couches. `tired` is the couch that yawns or dozes (the one whose clock
 * says it's late), else the right one.
 */
export function playIdle(move: IdleMove, me: CouchEl, pt: CouchEl, tired?: CouchEl): Promise<unknown> {
  switch (move) {
    case "glance":
      return glance(me, pt);
    case "yawn":
      return yawn(tired ?? pt);
    case "nudge":
      return nudge(me, pt);
    case "hi5":
      return hi5(me, pt);
    case "doze":
      return doze(tired ?? pt);
  }
}
