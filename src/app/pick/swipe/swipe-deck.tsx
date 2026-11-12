"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, useTransition, type PointerEvent } from "react";
import { Burst } from "@/components/burst";
import { ArrowIcon } from "@/components/icons";
import { Poster } from "@/components/poster";
import { PosterTab } from "@/components/poster-tab";
import { getMessages } from "@/lib/i18n";
import type { Swipes } from "@/lib/pick-rules";
import type { MediaType, Verdict } from "@/lib/watch";
import { clearSwipes, planMatch, recordSwipe, swipeStatus, undoSwipe, type SwipeStatus } from "../actions";
import { useCoupleChanges } from "../couple-changes";

/** One card in the day's deck, as the server dealt it. */
export type DeckCard = {
  key: string;
  media_type: MediaType;
  tmdb_id: number;
  title: string;
  poster_path: string | null;
  verdict: Verdict;
  /** Year, film or series, length. */
  tags: string[];
  href: string;
};

/** A drag further than this (px) sends the card off that way; a shorter one springs back. */
const SWIPE_PX = 96;
/** A quick flick sends it off from a shorter drag (px per ms). */
const FLICK_SPEED = 0.6;
/** How many cards of the pile are drawn (the top one and the two peeking out under it). */
const PILE = 3;

/*
 * Which matches have already popped up on this device today: kept in localStorage (a per-device
 * convenience), with a copy in memory for when storage is blocked, so a closed pop-up stays closed.
 */
const SEEN_EVENT = "swipe-seen";
const seenInMemory = new Map<string, string>();

function readSeen(key: string) {
  const kept = seenInMemory.get(key);
  if (kept !== undefined) return kept;
  try {
    return localStorage.getItem(key) ?? "[]";
  } catch {
    return "[]";
  }
}

function writeSeen(key: string, value: string) {
  seenInMemory.set(key, value);
  try {
    localStorage.setItem(key, value);
  } catch {}
  dispatchEvent(new Event(SEEN_EVENT));
}

function subscribeSeen(changed: () => void) {
  addEventListener(SEEN_EVENT, changed);
  return () => {
    removeEventListener(SEEN_EVENT, changed);
  };
}

function parseSeen(raw: string) {
  try {
    const keys: unknown = JSON.parse(raw);
    return new Set(Array.isArray(keys) ? keys.filter((k): k is string => typeof k === "string") : []);
  } catch {
    return new Set<string>();
  }
}

/** A copy of `swipes` without `key`. */
function without(swipes: Swipes, key: string) {
  const next = { ...swipes };
  delete next[key];
  return next;
}

function reducedMotion() {
  return matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Keys that shouldn't swipe: typing in a field, or a shortcut with a modifier. */
function ignoresKeys(event: KeyboardEvent) {
  const target = event.target as HTMLElement | null;
  return (
    event.defaultPrevented ||
    event.altKey ||
    event.ctrlKey ||
    event.metaKey ||
    !!target?.closest("input, textarea, select, [contenteditable]")
  );
}

/**
 * The swipe deck (/pick/swipe). Each of you goes through the same cards on your own screen: drag the top
 * card right for yes or left for no (it follows your finger), or use the buttons or ← and →. A title you've
 * both said yes to is a match: it pops up on both screens (your partner's yes arrives over Realtime), with
 * Plan it, Watch now and Keep swiping. Your partner's count shows, never which cards they liked.
 */
export function SwipeDeck({
  coupleId,
  day,
  cards,
  initialMine,
  initialStatus,
  partnerName,
  language,
}: {
  coupleId: string;
  /** The deck's day (daySeed()): swipes are saved under it. */
  day: string;
  cards: DeckCard[];
  initialMine: Swipes;
  initialStatus: Pick<SwipeStatus, "partnerCount" | "matches">;
  /** Null until your partner has joined. */
  partnerName: string | null;
  language: string;
}) {
  const t = getMessages(language).pick.swipe;
  const [mine, setMine] = useState<Swipes>(initialMine);
  /** What you've swiped since opening the page, latest last, for Undo. */
  const [history, setHistory] = useState<string[]>([]);
  const [status, setStatus] = useState(initialStatus);
  const [failed, setFailed] = useState(false);
  /** Matches you've already seen pop up today (null until read from this device, i.e. while rendering on the server). */
  const storageKey = `swipe-seen:${day}`;
  const seenRaw = useSyncExternalStore(subscribeSeen, () => readSeen(storageKey), () => null);
  const seen = useMemo(() => (seenRaw === null ? null : parseSeen(seenRaw)), [seenRaw]);
  const [planning, startPlanning] = useTransition();
  const [planError, setPlanError] = useState<string>();

  const top = useRef<HTMLElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const busy = useRef(false);
  const drag = useRef<{ x: number; y: number; id: number; t: number; moved: boolean } | null>(null);

  const left = cards.filter((card) => !(card.key in mine));
  const current = left[0];
  const done = cards.length - left.length;
  const byKey = new Map(cards.map((card) => [card.key, card]));
  const order = new Map(cards.map((card, i) => [card.key, i]));
  const matched = status.matches
    .filter((key) => byKey.has(key))
    .toSorted((a, b) => order.get(a)! - order.get(b)!)
    .map((key) => byKey.get(key)!);
  // The first match you haven't seen pop up yet.
  const open = seen ? matched.find((card) => !seen.has(card.key)) : undefined;

  function remember(next: Set<string>) {
    writeSeen(storageKey, JSON.stringify([...next]));
  }

  // The match pops up as a modal on both screens; closing it (Keep swiping, Esc) marks it seen.
  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  useCoupleChanges(coupleId, "swipes", async () => {
    const next = await swipeStatus(day);
    if (next.ok) setStatus(next);
  });

  function settle(result: SwipeStatus) {
    setFailed(!result.ok);
    if (result.ok) setStatus({ partnerCount: result.partnerCount, matches: result.matches });
  }

  /** Saves a yes or no on the top card (it's already on its way off screen). */
  async function commit(card: DeckCard, liked: boolean) {
    setMine((m) => ({ ...m, [card.key]: liked }));
    setHistory((h) => [...h, card.key]);
    const result = await recordSwipe(day, { media_type: card.media_type, tmdb_id: card.tmdb_id }, liked);
    if (!result.ok) {
      setMine((m) => without(m, card.key));
      setHistory((h) => h.filter((key) => key !== card.key));
    }
    settle(result);
  }

  /** Sends the top card off, right for yes and left for no, then saves it. */
  async function decide(liked: boolean) {
    const card = current;
    const el = top.current;
    if (!card || busy.current) return;
    busy.current = true;
    if (el && !reducedMotion()) {
      const dir = liked ? 1 : -1;
      el.style.setProperty(liked ? "--yes" : "--no", "1");
      // Fly from a fixed spot over the page: a fixed card going off screen doesn't widen the page (no
      // sideways scrollbar, no zooming out on phones) the way one in the column would.
      const dragged = el.style.transform;
      el.style.transform = "";
      const r = el.getBoundingClientRect();
      Object.assign(el.style, {
        position: "fixed",
        left: `${r.left + r.width / 2 - el.offsetWidth / 2}px`,
        top: `${r.top + r.height / 2 - el.offsetHeight / 2}px`,
        width: `${el.offsetWidth}px`,
        zIndex: "40",
        transform: dragged,
      });
      const animation = el.animate(
        [{ transform: `translate(${dir * (innerWidth * 0.6 + 240)}px, -48px) rotate(${dir * 26}deg)` }],
        { duration: 320, easing: "cubic-bezier(.3,.7,.4,1)", fill: "forwards" },
      );
      await animation.finished.catch(() => {});
    }
    busy.current = false;
    await commit(card, liked);
  }

  async function undo() {
    const key = history.at(-1);
    const card = key && byKey.get(key);
    if (!card || busy.current) return;
    const was = mine[key];
    setHistory((h) => h.slice(0, -1));
    setMine((m) => without(m, key));
    const result = await undoSwipe(day, { media_type: card.media_type, tmdb_id: card.tmdb_id });
    if (!result.ok) {
      setMine((m) => ({ ...m, [key]: was }));
      setHistory((h) => [...h, key]);
    }
    settle(result);
  }

  async function startAgain() {
    const before = mine;
    setMine({});
    setHistory([]);
    remember(new Set());
    const result = await clearSwipes(day);
    if (!result.ok) setMine(before);
    settle(result);
  }

  // ← no, → yes, anywhere on the page (not while typing, or while a match is showing).
  const keys = useRef(decide);
  useEffect(() => {
    keys.current = decide;
  });
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (ignoresKeys(event) || dialog.current?.open) return;
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      event.preventDefault();
      keys.current(event.key === "ArrowRight");
    };
    addEventListener("keydown", onKey);
    return () => {
      removeEventListener("keydown", onKey);
    };
  }, []);

  function onPointerDown(event: PointerEvent<HTMLElement>) {
    if (busy.current || event.button !== 0) return;
    drag.current = { x: event.clientX, y: event.clientY, id: event.pointerId, t: event.timeStamp, moved: false };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: PointerEvent<HTMLElement>) {
    const d = drag.current;
    const el = top.current;
    if (!d || !el || event.pointerId !== d.id) return;
    const dx = event.clientX - d.x;
    const dy = event.clientY - d.y;
    if (!d.moved && Math.hypot(dx, dy) < 6) return;
    d.moved = true;
    el.dataset.dragging = "";
    if (!reducedMotion()) el.style.transform = `translate(${dx}px, ${dy * 0.2}px) rotate(${dx * 0.06}deg)`;
    el.style.setProperty("--yes", String(Math.max(0, Math.min(1, dx / SWIPE_PX))));
    el.style.setProperty("--no", String(Math.max(0, Math.min(1, -dx / SWIPE_PX))));
  }

  function release(event: PointerEvent<HTMLElement>, cancelled: boolean) {
    const d = drag.current;
    const el = top.current;
    if (!d || event.pointerId !== d.id) return;
    drag.current = null;
    if (!el || !d.moved) return;
    delete el.dataset.dragging;
    const dx = event.clientX - d.x;
    const speed = Math.abs(dx) / Math.max(event.timeStamp - d.t, 1);
    if (!cancelled && (Math.abs(dx) > SWIPE_PX || (Math.abs(dx) > 40 && speed > FLICK_SPEED))) {
      decide(dx > 0);
      return;
    }
    // A short drag: back onto the pile (the CSS transition springs it).
    el.style.transform = "";
    el.style.removeProperty("--yes");
    el.style.removeProperty("--no");
  }

  function plan(card: DeckCard) {
    setPlanError(undefined);
    startPlanning(async () => {
      const result = await planMatch({ media_type: card.media_type, tmdb_id: card.tmdb_id });
      if (result?.error) setPlanError(result.error);
    });
  }

  const pile = left.slice(0, PILE);
  return (
    <div className="grid gap-6">
      <div className="grid justify-items-center gap-5">
        {current ? (
          <div data-swipe-pile className="grid w-[min(100%,14rem)] sm:w-[18rem]">
            {pile
              .map((card, place) => (
                <article
                  key={card.key}
                  ref={place === 0 ? top : undefined}
                  data-swipe-card
                  data-place={place}
                  data-key={card.key}
                  aria-roledescription={place === 0 ? "card" : undefined}
                  aria-label={place === 0 ? t.card(card.title, done + 1, cards.length) : undefined}
                  aria-hidden={place === 0 ? undefined : true}
                  inert={place !== 0}
                  onPointerDown={place === 0 ? onPointerDown : undefined}
                  onPointerMove={place === 0 ? onPointerMove : undefined}
                  onPointerUp={place === 0 ? (event) => release(event, false) : undefined}
                  onPointerCancel={place === 0 ? (event) => release(event, true) : undefined}
                  className="card grid content-start gap-3 p-3 select-none"
                >
                  <div className="poster-frame mt-2">
                    <Poster path={card.poster_path} title={card.title} size="fluid" eager={place < 2} language={language} />
                    <PosterTab verdict={card.verdict} partnerName={partnerName} language={language} />
                    <span aria-hidden className="swipe-stamp swipe-stamp-yes">
                      {t.yesStamp}
                    </span>
                    <span aria-hidden className="swipe-stamp swipe-stamp-no">
                      {t.noStamp}
                    </span>
                  </div>
                  <h2 className="line-clamp-2 text-xl font-bold leading-tight">{card.title}</h2>
                  <ul className="flex flex-wrap gap-1.5">
                    {card.tags.map((tag) => (
                      <li key={tag} className="paper rounded-full border-[2.5px] border-outline px-2.5 text-sm font-bold">
                        {tag}
                      </li>
                    ))}
                  </ul>
                </article>
              ))
              // The top card last, so it's painted (and read) on top.
              .reverse()}
          </div>
        ) : (
          <div className="card grid w-full justify-items-center gap-3 px-6 py-10 text-center">
            <p className="display-ink text-2xl">{t.done.heading}</p>
            <p className="max-w-[46ch] text-muted">{partnerName ? t.done.body(partnerName) : t.done.bodyAlone}</p>
            {done > 0 && (
              <button type="button" className="btn-quiet" onClick={startAgain}>
                {t.startAgain}
              </button>
            )}
          </div>
        )}

        {current && (
          <div className="flex items-center justify-center gap-3 sm:gap-4">
            <button type="button" className="btn-quiet swipe-button" onClick={() => decide(false)}>
              <CrossIcon />
              {t.no}
            </button>
            <button
              type="button"
              className="btn-quiet swipe-button-small"
              onClick={undo}
              disabled={history.length === 0}
              aria-label={t.undo}
              title={t.undo}
            >
              <UndoIcon />
            </button>
            <button type="button" className="btn swipe-button" onClick={() => decide(true)}>
              <HeartIcon />
              {t.yes}
            </button>
          </div>
        )}
        {/* Phones swipe; the keys line is for keyboards. */}
        {current && <p className="text-center text-sm text-muted max-sm:hidden">{t.keys}</p>}
        {failed && (
          <p role="alert" className="text-sm font-semibold text-danger">
            {t.failed}
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-5 gap-y-2 text-[15px] font-semibold">
        <span className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <span className="flex items-center gap-2">
            <span aria-hidden className="size-3 shrink-0 rounded-full border-2 border-outline bg-me" />
            {t.progress(done, cards.length)}
          </span>
          {partnerName && (
            <span className="flex items-center gap-2" aria-live="polite">
              <span aria-hidden className="size-3 shrink-0 rounded-full border-2 border-outline bg-partner" />
              {status.partnerCount > 0 ? t.partnerCount(partnerName, status.partnerCount) : t.partnerNone(partnerName)}
            </span>
          )}
        </span>
        {current && done > 0 && (
          <button type="button" className="tap-area text-sm font-bold underline underline-offset-4" onClick={startAgain}>
            {t.startAgain}
          </button>
        )}
      </div>

      {matched.length > 0 && (
        <section aria-labelledby="swipe-matches" className="grid gap-3">
          <h2 id="swipe-matches" className="display -rotate-1 text-[2rem]">
            {t.matches}
          </h2>
          <ul className="flex flex-wrap gap-4">
            {matched.map((card) => (
              <li key={card.key}>
                <Link href={card.href} className="card grid w-36 gap-2 p-2.5 transition duration-150 ease-(--ease-spring) hover:-translate-y-1">
                  <span className="poster-frame mt-1.5">
                    <Poster path={card.poster_path} title={card.title} size="fluid" language={language} />
                    <PosterTab verdict={card.verdict} partnerName={partnerName} language={language} compact />
                  </span>
                  <span className="line-clamp-2 text-[15px] font-bold leading-tight">{card.title}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p aria-live="polite" className="sr-only">
        {open ? t.match.announce(open.title) : ""}
      </p>

      <dialog
        ref={dialog}
        aria-labelledby="swipe-match-heading"
        className="swipe-match"
        onClose={() => {
          if (open && seen) remember(new Set(seen).add(open.key));
        }}
      >
        {open && (
          <div className="card grid justify-items-center gap-4 bg-both-soft px-5 pb-6 pt-8 text-center sm:px-8">
            <div className="relative w-40 sm:w-44">
              <div className="poster-frame -rotate-2">
                <Poster path={open.poster_path} title={open.title} size="fluid" eager language={language} className="shadow-[6px_6px_0_var(--outline)]" />
              </div>
              <span className="absolute -right-14 -top-10 sm:-right-16">
                <Burst className="size-28 sm:size-32" textClass="text-[22px] sm:text-[25px]">
                  {t.match.word}
                </Burst>
              </span>
            </div>
            <div className="grid gap-1">
              <h2 id="swipe-match-heading" className="display-ink text-[1.75rem] leading-none">
                {t.match.heading}
              </h2>
              <p className="text-xl font-bold leading-tight [overflow-wrap:anywhere]">{open.title}</p>
            </div>
            <div className="flex flex-wrap justify-center gap-2.5">
              <button type="button" className="btn" onClick={() => plan(open)} disabled={planning}>
                {t.match.planIt}
              </button>
              <Link href={open.href} className="btn-quiet">
                {t.match.watchNow}
                <ArrowIcon className="size-4" />
              </Link>
              <button type="button" className="btn-quiet" onClick={() => dialog.current?.close()}>
                {t.match.keepSwiping}
              </button>
            </div>
            {planError && (
              <p role="alert" className="text-sm font-semibold text-danger">
                {planError}
              </p>
            )}
          </div>
        )}
      </dialog>
    </div>
  );
}

function CrossIcon() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="size-5 shrink-0" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round">
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

function HeartIcon() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="size-5 shrink-0" stroke="currentColor" strokeWidth={2.25} strokeLinejoin="round">
      <path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.3a4.3 4.3 0 0 1 7.5 2.5C19.5 15.4 12 20 12 20z" fill="var(--me)" />
    </svg>
  );
}

function UndoIcon() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="size-5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 7 4.5 11.5 9 16" />
      <path d="M5 11.5h9.5a5 5 0 0 1 0 10H12" />
    </svg>
  );
}
