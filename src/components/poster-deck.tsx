"use client";

import Image from "next/image";
import { Fragment, useEffect, useRef, useState, ViewTransition, type CSSProperties, type PointerEvent } from "react";
import { flushSync } from "react-dom";
import { isSavingData } from "@/lib/data-saver";
import { getMessages } from "@/lib/i18n";
import { tmdbImage } from "@/lib/watch";

/**
 * Where each place in the pile sits on a 200px-wide deck (px, px, degrees), the top first: a messy pile
 * whose cards peek out a little each way. Wider decks scale x and y (--u in globals.css).
 */
const PILE = [
  { x: 0, y: 0, r: -2 },
  { x: 4.9, y: 1.5, r: 2.5 },
  { x: -5.6, y: 3, r: -7 },
  { x: 7, y: 4, r: 5 },
  { x: -3.5, y: 5.5, r: -5.5 },
  { x: 6.3, y: 6.5, r: 4.5 },
];

const SPRING = "cubic-bezier(0.2, 1.4, 0.4, 1)";
/** How far the cards fall when they drop onto the pile, in px (phones, then from 640px wide). */
const FALL = { phone: 656, wide: 608 };
/** A drag further than this (px) sends the top card off that way; a shorter one springs back. */
const SWIPE = 60;
/** The cards' image sizes: as wide as the deck (200px, 240px from 640px wide). */
const SIZES = "(min-width: 640px) 240px, 200px";

type Spot = { x: number; y: number; r: number; s?: number };

const tf = (p: Spot) => `translate(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px) rotate(${p.r.toFixed(2)}deg) scale(${p.s ?? 1})`;

function reducedMotion() {
  return matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Waits until a page transition that may be carrying the top card in (the poster morph) has finished. */
async function afterViewTransitions() {
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  const active = (document as Document & { activeViewTransition?: { finished: Promise<void> } | null }).activeViewTransition;
  const running = document
    .getAnimations()
    .filter((a) => (a.effect as KeyframeEffect | null)?.pseudoElement?.startsWith("::view-transition"));
  await Promise.all([active?.finished, ...running.map((a) => a.finished)].map((p) => p?.catch(() => {})));
}

/**
 * The title page's poster as a deck of TMDB's posters (`posters`, top first, at least two). The deck is
 * one button: a tap, Enter or Space tucks the top card under the pile and brings up the next; on phones
 * the top card follows a swipe and flies off whichever way it was swiped. It's just for fun: nothing is
 * saved.
 *
 * On arrival the top card is the page's poster (`morph`, so it morphs in from the list), then the others
 * drop onto the pile under it, bottom card first. Cards underneath load small (w185); a card gets its full
 * size when it comes to the top, and the next one is fetched ahead unless Data saver is on. Reduced
 * motion: no drop, and the next poster fades in.
 */
export function PosterDeck({ posters, morph, language }: { posters: string[]; morph: string; language: string }) {
  const n = posters.length;
  /** order[k] is the card (an index into posters) at place k in the pile; place 0 is the top. */
  const [order, setOrder] = useState(() => posters.map((_, i) => i));
  /** Cards that have been, or are about to be, on top: they load their full size. */
  const [full, setFull] = useState(() => new Set([0]));
  const [arriving, setArriving] = useState(true);
  const deck = useRef<HTMLButtonElement>(null);
  const cards = useRef<(HTMLSpanElement | null)[]>([]);
  const running = useRef<Animation[]>([]);
  const busy = useRef(true);
  const drag = useRef<{ x: number; y: number; id: number; moved: boolean; spot?: Spot } | null>(null);
  const dragged = useRef(false);
  /** The pile's order for event handlers and animations (always set alongside `order`). */
  const orderRef = useRef(order);

  /** Place k in px for this deck's width. */
  const place = (k: number): Spot => {
    const u = (deck.current?.offsetWidth ?? 200) / 200;
    return { x: PILE[k].x * u, y: PILE[k].y * u, r: PILE[k].r };
  };
  const el = (card: number) => cards.current[card]!;

  function play(target: HTMLElement, keyframes: Keyframe[], duration: number, options: { easing?: string; delay?: number } = {}) {
    const animation = target.animate(keyframes, { duration, fill: "both", easing: options.easing ?? "linear", delay: options.delay ?? 0 });
    running.current.push(animation);
    return animation.finished.then(
      () => {},
      () => {},
    );
  }

  /** Lets go of everything the animations and a drag were holding, so the cards sit where React puts them. */
  function release() {
    for (const card of cards.current) {
      if (!card) continue;
      card.style.transform = "";
      card.style.zIndex = "";
    }
    for (const animation of running.current) animation.cancel();
    running.current = [];
  }

  /** Commits the pile's new order, then releases the cards into it. */
  function settle(next: number[]) {
    orderRef.current = next;
    flushSync(() => setOrder(next));
    release();
    // Fetch the next poster's full size ahead, so it comes up sharp.
    if (!isSavingData()) setFull((loaded) => (loaded.has(next[1]) ? loaded : new Set(loaded).add(next[1])));
  }

  // Arrival: the top card is already there (morphed in from the list, or loaded with the page); the rest
  // wait hidden (globals.css, [data-arriving]) and drop in under it once the page transition is over.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (reducedMotion()) {
        setArriving(false);
        busy.current = false;
        return;
      }
      await afterViewTransitions();
      if (cancelled) return;
      const pile = orderRef.current;
      const fall = innerWidth >= 640 ? FALL.wide : FALL.phone;
      const drops = pile
        .map((card, k) => ({ card, k }))
        .slice(1)
        .reverse()
        .map(({ card, k }, j) => {
          const p = place(k);
          const spin = (k % 2 ? 1 : -1) * (14 + 6 * k) * 0.8;
          const start = { x: p.x + (k % 2 ? 22 : -18), y: p.y - fall, r: p.r + spin };
          const land = { ...p, y: p.y + 5 };
          return play(
            el(card),
            [
              { transform: tf(start), easing: "cubic-bezier(.55,0,.85,.45)" },
              { transform: `${tf(land)} scale(1.05, 0.93)`, offset: 0.62, easing: "cubic-bezier(.2,1.6,.4,1)" },
              { transform: tf(p) },
            ],
            640,
            { delay: j * 95 },
          );
        });
      // The animations now hold each card above the screen, so the cards can be shown.
      flushSync(() => setArriving(false));
      await Promise.all(drops);
      if (cancelled) return;
      settle(pile);
      busy.current = false;
    })();
    return () => {
      cancelled = true;
    };
    // Once, on arrival.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Tucks the top card under the pile; `dir` is the way it leaves (1 right, -1 left), `from` where a drag left it. */
  async function shuffle(dir: number, from?: Spot) {
    if (busy.current || n < 2) return;
    busy.current = true;
    const pile = orderRef.current;
    const [top, ...rest] = pile;
    const next = [...rest, top];
    setFull((loaded) => (loaded.has(rest[0]) ? loaded : new Set(loaded).add(rest[0])));

    if (reducedMotion()) {
      settle(next);
      await play(el(rest[0]), [{ opacity: 0 }, { opacity: 1 }], 220, { easing: "ease-out" });
      release();
      busy.current = false;
      return;
    }

    const w = deck.current?.offsetWidth ?? 200;
    const h = w * 1.5;
    const out = { x: dir * w * 1.08, y: -h * 0.07, r: dir * 16, s: 1.03 };
    // The rest step up a place with a small lift, a beat after the top card starts to go.
    const steps = rest.map((card, i) =>
      play(el(card), [{ transform: tf(place(i + 1)) }, { transform: tf({ ...place(i), s: 1.025 }), offset: 0.6 }, { transform: tf(place(i)) }], 460, {
        easing: SPRING,
        delay: 120 + i * 55,
      }),
    );
    el(rest[0]).setAttribute("data-top", "");
    el(top).removeAttribute("data-top");
    await play(el(top), [{ transform: tf(from ?? place(0)) }, { transform: tf(out) }], 300, { easing: "cubic-bezier(.3,.7,.4,1)" });
    el(top).style.zIndex = "0";
    await play(el(top), [{ transform: tf(out) }, { transform: tf(place(n - 1)) }], 420, { easing: SPRING });
    await Promise.all(steps);
    settle(next);
    busy.current = false;
  }

  function onPointerDown(event: PointerEvent<HTMLButtonElement>) {
    dragged.current = false;
    if (busy.current || event.button !== 0) return;
    drag.current = { x: event.clientX, y: event.clientY, id: event.pointerId, moved: false };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: PointerEvent<HTMLButtonElement>) {
    const d = drag.current;
    if (!d || event.pointerId !== d.id) return;
    const dx = event.clientX - d.x;
    const dy = event.clientY - d.y;
    if (!d.moved && Math.hypot(dx, dy) < 6) return;
    d.moved = true;
    d.spot = { x: dx, y: dy * 0.25, r: -2 + dx * 0.07 };
    if (!reducedMotion()) el(orderRef.current[0]).style.transform = tf(d.spot);
  }

  function onPointerUp(event: PointerEvent<HTMLButtonElement>) {
    const d = drag.current;
    if (!d || event.pointerId !== d.id) return;
    drag.current = null;
    if (!d.moved) return; // a tap: the click shuffles
    dragged.current = true;
    const dx = event.clientX - d.x;
    if (Math.abs(dx) > SWIPE) shuffle(Math.sign(dx), reducedMotion() ? undefined : d.spot);
    else springBack(d.spot);
  }

  function onPointerCancel(event: PointerEvent<HTMLButtonElement>) {
    const d = drag.current;
    if (!d || event.pointerId !== d.id) return;
    drag.current = null;
    if (d.moved) springBack(d.spot);
  }

  /** A short drag: the top card springs back onto the pile. */
  async function springBack(from: Spot | undefined) {
    if (!from || reducedMotion()) return;
    busy.current = true;
    await play(el(orderRef.current[0]), [{ transform: tf(from) }, { transform: tf(place(0)) }], 380, { easing: SPRING });
    settle(orderRef.current);
    busy.current = false;
  }

  const shown = order[0] + 1;
  return (
    <button
      ref={deck}
      type="button"
      className="poster-deck"
      data-arriving={arriving || undefined}
      aria-label={getMessages(language).title.shufflePosters(shown, n)}
      onClick={(event) => {
        // A drag already did its thing; keyboard clicks (detail 0) always shuffle.
        if (dragged.current && event.detail !== 0) {
          dragged.current = false;
          return;
        }
        shuffle(1);
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
    >
      {posters.map((path, card) => {
        const k = order.indexOf(card);
        const style = { "--x": PILE[k].x, "--y": PILE[k].y, "--r": PILE[k].r, "--z": n - k } as CSSProperties;
        const face = (
          <span
            ref={(node) => {
              cards.current[card] = node;
            }}
            className="deck-card"
            data-top={k === 0 ? "" : undefined}
            style={style}
          >
            {/* The page's own poster starts on top at full size; the others start small. */}
            {/* Underneath, only slivers show: one small size for every screen, so no srcset. */}
            {card !== 0 && <Image src={tmdbImage(path, "w185")} alt="" width={200} height={300} unoptimized loading="eager" draggable={false} />}
            {full.has(card) && (
              <Image
                src={tmdbImage(path, "w500")}
                alt=""
                width={200}
                height={300}
                sizes={SIZES}
                loading="eager"
                fetchPriority={card === 0 ? "high" : undefined}
                draggable={false}
              />
            )}
          </span>
        );
        // The page's poster keeps the morph name, so going back flies it home to the list.
        return card === 0 ? (
          <ViewTransition key={path} name={morph} share="morph" default="none">
            {face}
          </ViewTransition>
        ) : (
          <Fragment key={path}>{face}</Fragment>
        );
      })}
    </button>
  );
}
