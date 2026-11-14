"use client";

import { useEffect, useRef } from "react";
import { sparkles } from "@/lib/fx";
import { anim, isCalm, isReduced, OUT, sc, SPRING } from "@/lib/motion";
import { watchFirstSight } from "@/lib/seen";

/*
 * Numbers that roll in (Sprint 28, motion lab "stats"). Rendered as a hidden span (no box, so it never adds
 * a grid gap); it looks after every `[data-roll-group]` in its parent element (and the parent itself), and
 * plays each group once, when it scrolls into view:
 *
 * - `[data-odo]` (from <RollText>): each digit spins up like a fruit machine, later digits a little later.
 * - `[data-bar-y]`: columns spring up from the baseline, one after another (Stats' months).
 * - `[data-bar-x]`: bars grow from the left (genres, the taste progress).
 * - `[data-clip-x]`: a bar with words inside is uncovered from the left (who added what).
 * - `[data-meter]`: the taste match fills from your colour to your partner's, then pops a heart; the
 *   `[data-count]` beside it counts up (`data-to`, `data-format="percent"`) and jumps.
 *
 * Before a group plays, CSS holds it at its start ("Sprint 28" in globals.css: `data-roll-state="wait"`,
 * and briefly before hydration). Calm: quick and without stagger. Reduced motion: final values, faded in.
 * Pass a `key` to play again (Stats does, per year). Only transform, opacity and clip-path move.
 */

const DIGIT_EASE = "cubic-bezier(.2,.7,.25,1.08)";
const METER_EASE = "cubic-bezier(.3,1.25,.5,1)";

function rollDigits(odo: HTMLElement, calm: boolean) {
  odo.querySelectorAll<HTMLElement>("[data-d]").forEach((digit, i) => {
    const face = digit.firstElementChild as HTMLElement | null;
    const n = Number(digit.dataset.d);
    const h = digit.getBoundingClientRect().height;
    if (!face || !h || Number.isNaN(n)) return;
    const strip = document.createElement("span");
    strip.className = "odo-strip";
    strip.style.lineHeight = `${h}px`;
    for (let k = 0; k < 20; k++) {
      const line = document.createElement("span");
      line.textContent = String(k % 10);
      strip.append(line);
    }
    digit.append(strip);
    digit.dataset.rolling = "";
    face.style.opacity = "0";
    void anim(strip, [{ transform: "translate(-50%, 0)" }, { transform: `translate(-50%, ${-(10 + n) * h}px)` }], {
      duration: calm ? 400 : 900 + i * 220,
      easing: calm ? OUT : DIGIT_EASE,
      fill: "both",
    }).finished.then(() => {
      strip.remove();
      face.style.opacity = "";
      delete digit.dataset.rolling;
    });
  });
}

function countUp(el: HTMLElement, calm: boolean) {
  const to = Number(el.dataset.to);
  const final = el.textContent ?? "";
  if (!Number.isFinite(to)) return;
  const format = new Intl.NumberFormat(document.documentElement.lang || "en", el.dataset.format === "percent" ? { style: "percent" } : {});
  const value = (v: number) => format.format(el.dataset.format === "percent" ? v / 100 : v);
  const duration = calm ? 650 : 1450;
  const start = performance.now();
  const tick = () => {
    if (!el.isConnected) return;
    const p = Math.min(1, (performance.now() - start) / duration);
    el.textContent = p < 1 ? value(Math.round(to * Math.min(1, p * 1.05))) : final;
    if (p < 1) requestAnimationFrame(tick);
  };
  el.textContent = value(0);
  requestAnimationFrame(tick);
}

function play(group: HTMLElement) {
  if (isReduced()) {
    group.dataset.rollState = "done";
    void anim(group, [{ opacity: 0.3 }, { opacity: 1 }], { duration: 300 });
    return;
  }
  const calm = isCalm();
  group.querySelectorAll<HTMLElement>("[data-odo]").forEach((odo) => rollDigits(odo, calm));
  group.querySelectorAll<HTMLElement>("[data-bar-y]").forEach((bar, i) => {
    void anim(bar, [{ transform: "scaleY(0)" }, { transform: "scaleY(1)" }], {
      duration: calm ? 300 : 520,
      delay: calm ? 0 : 200 + i * 45,
      easing: calm ? OUT : SPRING,
      fill: "backwards",
    });
  });
  group.querySelectorAll<HTMLElement>("[data-bar-x]").forEach((bar, i) => {
    void anim(bar, [{ transform: "scaleX(0)" }, { transform: "scaleX(1)" }], {
      duration: calm ? 300 : 620,
      delay: calm ? 0 : 150 + i * 70,
      easing: calm ? OUT : SPRING,
      fill: "backwards",
    });
  });
  group.querySelectorAll<HTMLElement>("[data-clip-x]").forEach((bar) => {
    void anim(bar, [{ clipPath: "inset(-12px 100% -12px -12px)" }, { clipPath: "inset(-12px -12px -12px -12px)" }], {
      duration: calm ? 350 : 900,
      delay: calm ? 0 : 200,
      easing: calm ? OUT : "cubic-bezier(.3,1.1,.5,1)",
      fill: "backwards",
    });
  });
  group.querySelectorAll<HTMLElement>("[data-count]").forEach((count) => countUp(count, calm));
  group.querySelectorAll<HTMLElement>("[data-meter]").forEach((fill) => {
    const meter = anim(fill, [{ transform: "scaleX(0)" }, { transform: "scaleX(1)" }], {
      duration: calm ? 400 : 1200,
      delay: 250,
      easing: calm ? OUT : METER_EASE,
      fill: "backwards",
    });
    void meter.finished.then(() => {
      if (isCalm() || !fill.isConnected || meter.playState !== "finished") return;
      const r = fill.getBoundingClientRect();
      sparkles(r.right, r.top + r.height / 2, { count: 8, colors: ["var(--blush)", "var(--stamp)"], distance: 50, kind: "heart" });
      const pct = group.querySelector("[data-count]");
      if (pct) void anim(pct, [{ transform: "none" }, { transform: `scale(${sc(1.4)}) rotate(-6deg)` }, { transform: "none" }], { duration: 420, easing: SPRING });
    });
  });
  group.dataset.rollState = "done";
}

export function RollIn() {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const scope = ref.current?.parentElement;
    if (!scope) return;
    const groups = [
      ...(scope.matches("[data-roll-group]") ? [scope] : []),
      ...scope.querySelectorAll<HTMLElement>("[data-roll-group]"),
    ];
    const reduced = isReduced();
    for (const group of groups) group.dataset.rollState = reduced ? "done" : "wait";
    const stop = watchFirstSight(groups, {
      onSeen: (group) => play(group as HTMLElement),
      // Jumped past without showing: just the final values.
      onPassed: (group) => {
        (group as HTMLElement).dataset.rollState = "done";
      },
    });
    return () => {
      stop();
      for (const group of groups) {
        if (group.dataset.rollState === "wait") group.dataset.rollState = "done";
      }
    };
  }, []);

  return <span hidden ref={ref} />;
}
