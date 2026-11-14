"use client";

import { useEffect } from "react";
import { IDLE_MOVES, isMoving, playIdle, type IdleMove } from "@/lib/couch-moves";
import { isCalm, isWild } from "@/lib/motion";

/** Pairs of couches that get a life of their own: the logo and Home's clocks panel. */
const STAGES = "[data-logo-couches], [data-clocks]";
/** How long without a tap, key or scroll before the couches dare to move. */
const IDLE_AFTER_MS = 4000;
/** At most one move this often: the lab's 11 s at Lively, 5 s at Wild. */
const every = () => (isWild() ? 5000 : 11000);

/**
 * Couches with a life of their own (Sprint 27, the motion lab's "idle" scene): now and then, while you're not
 * doing anything, the visible pair of couches glances at each other, yawns (the one whose clock says it's
 * asleep), nudges, high-fives or dozes. Never at Calm or with reduced motion, never in a hidden tab, only
 * for couches on screen, and never on a couch that's already moving (a nudge, a ready check). Renders nothing;
 * the moves are in src/lib/couch-moves.ts.
 */
export function CouchLife() {
  useEffect(() => {
    let lastInput = Date.now();
    let since = 0;
    let busy = false;
    const onInput = () => {
      lastInput = Date.now();
    };
    const events = ["pointerdown", "keydown", "wheel", "touchstart", "scroll"] as const;
    for (const type of events) window.addEventListener(type, onInput, { passive: true, capture: true });

    const timer = setInterval(() => {
      if (document.hidden || isCalm() || busy) return;
      if (Date.now() - lastInput < IDLE_AFTER_MS) return;
      since += 1000;
      if (since < every()) return;
      const pair = visiblePair();
      if (!pair) return;
      since = 0;
      busy = true;
      const move: IdleMove = IDLE_MOVES[Math.floor(Math.random() * IDLE_MOVES.length)];
      void playIdle(move, pair.me, pair.partner, pair.tired).finally(() => {
        busy = false;
      });
    }, 1000);

    return () => {
      clearInterval(timer);
      for (const type of events) window.removeEventListener(type, onInput, { capture: true });
    };
  }, []);
  return null;
}

/** A pair of couches on screen and still (any of them, at random), with the one that's asleep by its clock if any. */
function visiblePair() {
  const stages = [...document.querySelectorAll(STAGES)].sort(() => Math.random() - 0.5);
  for (const stage of stages) {
    const couches = [...stage.querySelectorAll(".couch")].filter(onScreen);
    const me = couches.find((c) => !c.classList.contains("couch-partner"));
    const partner = couches.find((c) => c.classList.contains("couch-partner"));
    if (!me || !partner || isMoving(me) || isMoving(partner)) continue;
    // Home's clocks: each couch shares its column with that person's clock state.
    const asleep = (couch: Element) => couch.closest("[data-clocks] > div")?.querySelector('[data-clock-state="asleep"]');
    const tired = asleep(partner) ? partner : asleep(me) ? me : undefined;
    return { me, partner, tired };
  }
  return null;
}

function onScreen(el: Element) {
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth;
}
