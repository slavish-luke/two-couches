"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { sfx } from "@/lib/fx";
import { getMessages } from "@/lib/i18n";
import { amp, anim, center, isCalm, isWild, sc, shake, SPRING, wait } from "@/lib/motion";
import { countdown, formatCountdown, nextTick } from "@/lib/planning-rules";

/** The last stretch counts in seconds. */
const SECONDS_FROM_MS = 60 * 1000;

/**
 * The time left until a night, ticking in the browser: "in 2 d 4 h", "in 35 min", then in the last minute
 * "in 42 s", then "Starting now" and "Under way". Starts from the server's clock so the first render matches,
 * then wakes when the words change. Once it's starting it becomes a grape tag, like the night card's
 * "Under way".
 *
 * Sprint 27 (the motion lab's "ready" scene): changed digits flip, the last 3 seconds pulse, and if it reaches
 * zero while you're looking, curtains swish closed over the night's card with "Lights down!", then open
 * again. Calm and reduced motion: no flips or pulse, and "Lights down!" just fades in and out.
 */
export function Countdown({ startsAt, serverNow, language }: { startsAt: string; serverNow: number; language: string }) {
  const [now, setNow] = useState(serverNow);
  const ref = useRef<HTMLTimeElement>(null);
  /** Whether this countdown was still running while open: only then does zero bring the curtains. */
  const sawBefore = useRef(false);

  useEffect(() => {
    const start = new Date(startsAt);
    let timer: ReturnType<typeof setTimeout> | undefined;
    const tick = () => {
      const at = Date.now();
      setNow(at);
      const left = start.getTime() - at;
      if (left > 0 && left <= SECONDS_FROM_MS + 1000) {
        // Second by second, just after each second boundary of the time left.
        timer = setTimeout(tick, (left % 1000 || 1000) + 20);
        return;
      }
      const wait = nextTick(start, new Date(at));
      // At most a minute, so a computer waking from sleep catches up soon; never past the last minute's start.
      if (wait !== null) timer = setTimeout(tick, Math.max(50, Math.min(wait, 60_000, left > 0 ? left - SECONDS_FROM_MS : Infinity)));
    };
    timer = setTimeout(tick, 0);
    return () => {
      clearTimeout(timer);
    };
  }, [startsAt]);

  const start = new Date(startsAt);
  const left = start.getTime() - now;
  const seconds = left > 0 && left <= SECONDS_FROM_MS ? Math.ceil(left / 1000) : null;
  const kind = countdown(start, new Date(now)).kind;
  const started = seconds === null && (kind === "now" || kind === "underWay");
  const text = seconds !== null ? getMessages(language).nights.countdown.seconds(seconds) : formatCountdown(start, new Date(now), language);

  // Flip the digits that changed, pulse the last three seconds, and draw the curtains at zero.
  const shown = useRef(text);
  useLayoutEffect(() => {
    const el = ref.current;
    const before = shown.current;
    shown.current = text;
    if (!el || before === text) return;
    if (!isCalm() && !document.hidden) flipDigits(el, before, text);
    if (seconds !== null && seconds <= 3 && !isCalm() && !document.hidden) {
      void anim(el, [{ transform: "scale(1)" }, { transform: `scale(${sc(1.35)}) rotate(${(seconds % 2 ? -4 : 4) * amp()}deg)` }, { transform: "scale(1)" }], {
        duration: 400,
        easing: SPRING,
      });
      if (isWild()) shake(el.closest("[data-night-card]") ?? el, 3);
    }
  }, [text, seconds]);

  useEffect(() => {
    if (left > 0) {
      sawBefore.current = true;
      return;
    }
    if (!sawBefore.current) return;
    sawBefore.current = false;
    const el = ref.current;
    if (el && !document.hidden) void curtains(el, getMessages(language).nights.countdown.lightsDown);
  }, [left, language]);

  return (
    <time
      ref={ref}
      dateTime={startsAt}
      data-countdown={kind}
      className={
        started
          ? "rounded-full border-2 border-outline bg-accent px-2 text-sm font-bold text-on-accent"
          : "paper -rotate-2 whitespace-nowrap rounded-full border-2 border-outline px-2 text-sm font-bold tabular-nums"
      }
    >
      {/* Each digit in a little window of its own, so it can flip (globals.css, Sprint 27). */}
      {[...text].map((ch, i) =>
        /\d/.test(ch) ? (
          <span key={i} data-digit>
            <span>{ch}</span>
          </span>
        ) : (
          ch
        ),
      )}
    </time>
  );
}

/** Each digit that changed drops out and the new one drops in (when the text keeps its length). */
function flipDigits(el: HTMLElement, before: string, after: string) {
  const digits = [...el.querySelectorAll<HTMLElement>("[data-digit]")];
  const same = before.length === after.length;
  const chars = [...after];
  let d = 0;
  chars.forEach((ch, i) => {
    if (!/\d/.test(ch)) return;
    const digit = digits[d++];
    const face = digit?.firstElementChild;
    if (!digit || !face || (same && before[i] === ch)) return;
    if (same && /\d/.test(before[i] ?? "")) {
      const ghost = document.createElement("span");
      ghost.className = "cd-ghost";
      ghost.setAttribute("aria-hidden", "true");
      ghost.textContent = before[i];
      digit.append(ghost);
      void anim(ghost, [{ transform: "none", opacity: 1 }, { transform: "translateY(90%) rotateX(-70deg)", opacity: 0 }], {
        duration: 260,
        easing: "ease-in",
        fill: "forwards",
      }).finished.then(() => ghost.remove());
    }
    void anim(face, [{ transform: "translateY(-100%)" }, { transform: "translateY(10%)", offset: 0.7 }, { transform: "none" }], {
      duration: 340,
      easing: "ease-out",
    });
  });
}

/**
 * Curtains close over the night's card (Home's spotlight when it's there), "Lights down!" pops up, then
 * they open again. Drawn inside the card and clipped to it, so nothing reaches past its edges. Calm and
 * reduced motion: the words fade in and out over the card.
 */
async function curtains(from: HTMLElement, words: string) {
  const card = from.closest<HTMLElement>("[data-night-card]");
  const frame = card?.closest<HTMLElement>(".spotlight") ?? card;
  if (!frame || frame.getBoundingClientRect().height === 0) return;
  if (getComputedStyle(frame).position === "static") frame.style.position = "relative";
  // Its own stacking context while the curtains are up, so they cover the card but stay under the tab bar.
  const isolation = frame.style.isolation;
  frame.style.isolation = "isolate";
  const done = () => {
    stage.remove();
    frame.style.isolation = isolation;
  };

  const stage = document.createElement("div");
  stage.className = "night-curtains";
  stage.setAttribute("aria-hidden", "true");
  const left = document.createElement("span");
  left.dataset.curtain = "left";
  const right = document.createElement("span");
  right.dataset.curtain = "right";
  const lights = document.createElement("span");
  lights.className = "night-lights display";
  lights.textContent = words;
  stage.append(left, right, lights);
  frame.append(stage);

  const c = center(frame);
  sfx("lights", c.x, c.y - 70);
  if (isCalm()) {
    await anim(lights, [{ opacity: 0 }, { opacity: 1 }], { duration: 250, fill: "forwards" }).finished;
    await wait(1200);
    await anim(lights, [{ opacity: 1 }, { opacity: 0 }], { duration: 250, fill: "forwards" }).finished;
    done();
    return;
  }
  void anim(left, [{ transform: "translateX(-102%)" }, { transform: "translateX(4%) scaleX(1.05)", offset: 0.75 }, { transform: "translateX(0)" }], {
    duration: 560,
    easing: "ease-in",
    fill: "forwards",
  });
  await anim(right, [{ transform: "translateX(102%)" }, { transform: "translateX(-4%) scaleX(1.05)", offset: 0.75 }, { transform: "translateX(0)" }], {
    duration: 560,
    easing: "ease-in",
    fill: "forwards",
  }).finished;
  shake(frame, 3);
  void anim(lights, [{ opacity: 0, transform: "scale(.4)" }, { opacity: 1, transform: "scale(1.1)", offset: 0.7 }, { opacity: 1, transform: "none" }], {
    duration: 380,
    easing: "ease-out",
    fill: "forwards",
  });
  await wait(1500);
  void anim(lights, [{ opacity: 1 }, { opacity: 0 }], { duration: 200, fill: "forwards" });
  void anim(left, [{ transform: "translateX(0)" }, { transform: "translateX(-102%)" }], { duration: 520, easing: "cubic-bezier(.5,0,.2,1)", fill: "forwards" });
  await anim(right, [{ transform: "translateX(0)" }, { transform: "translateX(102%)" }], { duration: 520, easing: "cubic-bezier(.5,0,.2,1)", fill: "forwards" }).finished;
  done();
}
