"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Couch } from "@/components/couch";
import { NudgeSticker } from "@/components/nudge-sticker";
import { blush, hop, launch } from "@/lib/couch-moves";
import { fxLayer, heartPath, sfx, sparkles } from "@/lib/fx";
import { getMessages } from "@/lib/i18n";
import { amp, anim, center, flyArc, isCalm } from "@/lib/motion";
import { NUDGE_FRESH_MS, NUDGE_GAP_MS, NUDGE_KINDS, nudgeWait, type CouchMood, type NudgeKind } from "@/lib/together-rules";
import { sendNudge } from "./actions";

/** How long the couch's reaction plays. */
const REACTION_MS = 1700;

/** How long until you may nudge again after one sent at `sentAt` (ms since the epoch, 0 for never). */
function waitAfter(sentAt: number) {
  return nudgeWait(sentAt ? new Date(sentAt).toISOString() : null, Date.now());
}

/**
 * Your partner's couch on Home's clocks panel, as a button: tap it for a tray of three nudges (a heart,
 * "starting soon", "ready when you are"). Sending one makes their couch hop with the sticker floating up; so
 * does a nudge from them arriving while you look (`incoming`, the latest one sent to you that you haven't
 * marked seen; it arrives through ListSync). One a minute.
 *
 * Sprint 27 (the motion lab's "heart" scene): at Lively and Wild, with both couches on screen, the sticker
 * flies along an arc from the sender's couch to the other one (trailing little hearts for a heart; the alarm
 * clock rings when it lands; the popcorn spins), and the catching couch hops and blushes. Calm and reduced
 * motion keep the hop and floating sticker above.
 */
export function NudgeCouch(props: {
  partnerName: string;
  mood: CouchMood;
  language: string;
  lastSentAt: string | null;
  incoming: { id: string; kind: NudgeKind; sent_at: string } | null;
}) {
  const { partnerName, language } = props;
  const t = getMessages(language).together.nudge;
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<{ text: string; error?: boolean } | null>(null);
  const [reaction, setReaction] = useState<{ kind: NudgeKind; key: number } | null>(null);
  const sentAt = useRef(props.lastSentAt ? Date.parse(props.lastSentAt) : 0);
  const seen = useRef<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const couchRef = useRef<HTMLButtonElement>(null);
  const stickersRef = useRef<HTMLSpanElement>(null);


  // A nudge from them arriving live (or one sent moments before the page opened) makes their couch react.
  const { incoming } = props;
  useEffect(() => {
    if (!incoming || seen.current === incoming.id) return;
    const first = seen.current === null;
    seen.current = incoming.id;
    if (first && Date.now() - Date.parse(incoming.sent_at) > NUDGE_FRESH_MS) return;
    const timer = setTimeout(() => {
      if (document.hidden || !fly(rootRef.current, stickersRef.current, incoming.kind, false)) setReaction({ kind: incoming.kind, key: Date.now() });
    }, 0);
    return () => {
      clearTimeout(timer);
    };
  }, [incoming]);

  useEffect(() => {
    if (!reaction) return;
    const timer = setTimeout(() => setReaction(null), REACTION_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [reaction]);

  useEffect(() => {
    if (!status) return;
    const timer = setTimeout(() => setStatus(null), 4000);
    return () => {
      clearTimeout(timer);
    };
  }, [status]);

  // Escape closes the tray (focus goes back to the couch), and so does a tap anywhere else.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      couchRef.current?.focus();
    };
    const onPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  function send(kind: NudgeKind) {
    const wait = waitAfter(sentAt.current);
    if (wait > 0) {
      setStatus({ text: t.tooSoon(Math.ceil(wait / 1000)), error: true });
      return;
    }
    setOpen(false);
    startTransition(async () => {
      const result = await sendNudge(kind);
      if (result.error) {
        if (result.waitMs) sentAt.current = Date.now() - NUDGE_GAP_MS + result.waitMs;
        setStatus({ text: result.error, error: true });
        return;
      }
      sentAt.current = Date.now();
      if (!fly(rootRef.current, stickersRef.current, kind, true)) setReaction({ kind, key: Date.now() });
      setStatus({ text: t.sent(partnerName) });
    });
  }

  return (
    <div ref={rootRef} data-nudge-couch className="relative grid justify-items-center">
      <button
        ref={couchRef}
        type="button"
        aria-label={t.open(partnerName)}
        aria-expanded={open}
        disabled={pending}
        onClick={() => setOpen((o) => !o)}
        className="nudge-target relative block rounded-control transition-transform duration-150 ease-(--ease-spring) hover:-rotate-3 active:scale-95"
      >
        <span key={reaction?.key ?? 0} data-reacting={reaction ? "" : undefined} className="nudge-hop flex">
          <Couch who="partner" size={58} mood={props.mood} />
        </span>
        {/* The hint that it's a button: a little heart on its corner. */}
        <span aria-hidden className="nudge-badge absolute -right-2 -top-1.5 grid size-6 place-items-center rounded-full border-2 border-outline bg-surface">
          <NudgeSticker kind="heart" className="size-4" />
        </span>
        {reaction && (
          <span key={reaction.key} aria-hidden className="nudge-float pointer-events-none absolute left-1/2 top-0">
            <NudgeSticker kind={reaction.kind} className="size-9" />
          </span>
        )}
      </button>

      {/* The stickers a nudge's flight clones into the effects layer. */}
      <span ref={stickersRef} hidden aria-hidden>
        {NUDGE_KINDS.map((kind) => (
          <span key={kind} data-kind={kind}>
            <NudgeSticker kind={kind} className="size-10" />
          </span>
        ))}
      </span>

      {open && (
        <div
          role="group"
          aria-label={t.tray(partnerName)}
          data-nudge-tray
          // Over the name and clock below, anchored to the couch's right so it never runs off the card.
          className="paper absolute right-[-0.75rem] top-[calc(100%+0.25rem)] z-20 grid w-[10.5rem] grid-cols-3 gap-1 rounded-control border-[2.5px] border-outline p-1 shadow-[3px_3px_0_var(--outline)]"
        >
          {NUDGE_KINDS.map((kind) => (
            <button
              key={kind}
              type="button"
              autoFocus={kind === "heart"}
              aria-label={t.kinds[kind].label(partnerName)}
              onClick={() => send(kind)}
              className="grid min-w-0 justify-items-center gap-0.5 rounded-[10px] px-1 pb-0.5 pt-1 text-xs font-bold leading-tight transition hover:bg-current/10 focus-visible:bg-current/10"
            >
              <NudgeSticker kind={kind} className="size-6" />
              <span aria-hidden className="max-w-full truncate">
                {t.kinds[kind].short}
              </span>
            </button>
          ))}
        </div>
      )}

      <p aria-live="polite" className="absolute right-[-0.75rem] top-[calc(100%+0.25rem)] z-10 w-max max-w-[10.5rem]">
        {status && (
          <span
            className={`paper block rounded-control border-2 border-outline px-2 py-0.5 text-center text-xs font-bold ${status.error ? "text-danger" : ""}`}
          >
            {status.text}
          </span>
        )}
      </p>
    </div>
  );
}

/** Flies the sticker from one couch to the other; false when it can't (Calm, reduced, a couch off screen). */
function fly(root: HTMLElement | null, stickers: HTMLElement | null, kind: NudgeKind, toPartner: boolean) {
  if (isCalm() || !root) return false;
  const theirs = root.querySelector<SVGElement>(".couch");
  const mine = root.closest("[data-clocks]")?.querySelector<SVGElement>(".couch:not(.couch-partner)");
  const sticker = stickers?.querySelector(`[data-kind="${kind}"] svg`);
  if (!theirs || !mine || !sticker || !onScreen(theirs) || !onScreen(mine)) return false;
  void flight(kind, sticker, toPartner ? mine : theirs, toPartner ? theirs : mine);
  return true;
}

function onScreen(el: Element) {
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth;
}

/** The thrower squashes, the sticker arcs across (trailing hearts for a heart), and the catcher hops and blushes. */
async function flight(kind: NudgeKind, sticker: Element, from: SVGElement, to: SVGElement) {
  const layer = fxLayer();
  const icon = sticker.cloneNode(true) as SVGElement;
  icon.classList.add("nudge-flight");
  layer.append(icon);
  void launch(from);
  let last = 0;
  await flyArc(icon, center(from), center(to), {
    lift: 130 * amp(),
    duration: 950,
    scaleTo: 1.15,
    spin: kind === "ready" ? 360 : 0,
    onStep: (x, y, progress) => {
      if (kind !== "heart" || progress - last < 0.07) return;
      last = progress;
      const trail = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      trail.setAttribute("viewBox", "-8 -8 16 16");
      trail.setAttribute("width", "14");
      trail.setAttribute("height", "14");
      trail.innerHTML = `<path d="${heartPath(0, 0, 5)}" fill="var(--stamp)" stroke="var(--outline)" stroke-width="1.4"/>`;
      trail.style.left = `${x - 7}px`;
      trail.style.top = `${y - 7}px`;
      layer.append(trail);
      void anim(trail, [{ transform: "scale(1)", opacity: 0.9 }, { transform: `translateY(${8 + Math.random() * 16}px) scale(.2)`, opacity: 0 }], {
        duration: 700,
        easing: "ease-in",
      }).finished.then(() => trail.remove());
    },
  });
  const at = icon.style.transform;
  // The alarm clock rings where it lands.
  if (kind === "soon") {
    await anim(icon, [0, 1, 2, 3, 4, 5, 6].map((k) => ({ transform: `${at} rotate(${k % 2 ? 14 : -14}deg)` })), { duration: 500 }).finished;
  }
  void anim(icon, [{ opacity: 1 }, { opacity: 0, transform: `${at} scale(.3)` }], { duration: 200, fill: "forwards" }).finished.then(() => icon.remove());
  const c = center(to);
  void hop(to);
  blush(to);
  if (kind === "heart") sparkles(c.x, c.y - 20, { count: 8, colors: ["var(--blush)", "var(--stamp)"], distance: 55, kind: "heart" });
  else sparkles(c.x, c.y - 20, { count: 8, distance: 55 });
  if (kind === "heart") sfx("heart", c.x, c.y - 70);
  if (kind === "ready") sfx("ready", c.x, c.y - 70);
}
