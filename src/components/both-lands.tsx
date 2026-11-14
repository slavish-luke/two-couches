"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { flare, sfx, sparkles } from "@/lib/fx";
import { amp, anim, center, isCalm, isReduced, isWild, OUT, sc, SPRING, wait } from "@/lib/motion";
import { watchFirstSight } from "@/lib/seen";

/*
 * "We can both watch it" lands (Sprint 28, motion lab "both"). Wraps the title page's where-to-watch section
 * (a `display: contents` box, so the layout is the section's own). When the section first scrolls into view
 * and the verdict is "both": each country's services (`[data-svc]`) drop into their column, the ones you
 * each pay for (`[data-pays]`) light up, a line draws between the service you share (same `data-svc` id or
 * `data-svc-name`) or, if you pay for different ones, between the two column heads (`[data-where-head]`), the burst
 * (`[data-both-burst]`) lands with a spin, sparkles fly, the ground flares and POW! says its word.
 *
 * Once per visit: the verdict at mount decides, and refreshes (Realtime) never replay it. The line is an
 * overlay inside `[data-where-cols]` and is skipped when the columns stack (phones). Calm: everything
 * fades in and the burst pops. Reduced motion: plain.
 */

const SVG = "http://www.w3.org/2000/svg";

function resolved(el: Element, token: string) {
  return getComputedStyle(el).getPropertyValue(token).trim() || "transparent";
}

/** Draws the line between two boxes inside `cols`, then fades it away. */
async function drawLine(cols: HTMLElement, from: Element, to: Element) {
  const box = cols.getBoundingClientRect();
  const a = from.getBoundingClientRect();
  const b = to.getBoundingClientRect();
  const x1 = a.right - box.left;
  const y1 = a.top + a.height / 2 - box.top;
  const x2 = b.left - box.left;
  const y2 = b.top + b.height / 2 - box.top;
  const d = `M${x1} ${y1}C${x1 + 40} ${y1 - 30} ${x2 - 40} ${y2 - 30} ${x2} ${y2}`;
  const svg = document.createElementNS(SVG, "svg");
  svg.setAttribute("class", "both-line");
  svg.setAttribute("aria-hidden", "true");
  const paths = ["under", "over"].map((layer) => {
    const path = document.createElementNS(SVG, "path");
    path.setAttribute("d", d);
    path.setAttribute("pathLength", "1");
    if (layer === "under") path.setAttribute("data-under", "");
    svg.append(path);
    return path;
  });
  cols.append(svg);
  await Promise.all(
    paths.map(
      (path) => anim(path, [{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { duration: 420, easing: "ease-in-out", fill: "forwards" }).finished,
    ),
  );
  await wait(2200);
  await anim(svg, [{ opacity: 1 }, { opacity: 0 }], { duration: 400, easing: OUT, fill: "forwards" }).finished;
  svg.remove();
}

async function land(section: HTMLElement) {
  const calm = isCalm();
  const a = amp();
  const columns = [...section.querySelectorAll<HTMLElement>("[data-where-col]")];
  const services = [...section.querySelectorAll<HTMLElement>("[data-svc]")];
  const burst = section.querySelector<HTMLElement>("[data-both-burst]");

  // Services drop into their columns, row by row, the second column a beat behind.
  for (const service of services) {
    const col = Math.max(0, columns.findIndex((c) => c.contains(service)));
    const row = [...(columns[col]?.querySelectorAll("[data-svc]") ?? [])].indexOf(service);
    void anim(
      service,
      [
        { opacity: 0, transform: calm ? "translateY(4px)" : `translateY(${-40 * a}px) rotate(${(col ? 8 : -8) * a}deg)` },
        { opacity: 1, transform: "none" },
      ],
      { duration: calm ? 200 : 420, delay: calm ? 0 : row * 110 + col * 55, easing: calm ? OUT : SPRING, fill: "backwards" },
    );
  }
  if (burst) burst.style.opacity = "0";
  section.closest<HTMLElement>("[data-both-lands]")?.setAttribute("data-landed", "done");

  await wait(calm ? 250 : 650);
  if (!section.isConnected) return;

  if (!calm && columns.length === 2) {
    const [mine, theirs] = columns.map((c) => [...c.querySelectorAll<HTMLElement>("[data-svc][data-pays]")]);
    const glow = resolved(section, "--stamp");
    for (const service of [...mine, ...theirs]) {
      void anim(
        service,
        [
          { transform: "none", filter: "drop-shadow(0 0 0 transparent)" },
          { transform: `scale(${sc(1.12)})`, filter: `drop-shadow(0 0 7px ${glow})`, offset: 0.35 },
          { transform: "none", filter: "drop-shadow(0 0 0 transparent)" },
        ],
        { duration: 900, easing: SPRING },
      );
    }
    // The line only when the columns sit side by side.
    const [left, right] = columns.map((c) => c.getBoundingClientRect());
    const cols = section.querySelector<HTMLElement>("[data-where-cols]");
    if (cols && right.top < left.bottom && right.left >= left.right) {
      // The same service: the same TMDB id, or the same name (a service can have an id per country).
      const same = (x: HTMLElement, y: HTMLElement) =>
        x.dataset.svc === y.dataset.svc || (!!x.dataset.svcName && x.dataset.svcName === y.dataset.svcName);
      const shared = mine.find((m) => theirs.some((t) => same(m, t)));
      const partnerShared = shared && theirs.find((t) => same(shared, t));
      const ends =
        shared && partnerShared
          ? [shared, partnerShared]
          : columns.map((c) => c.querySelector("[data-where-head]")).filter((h): h is HTMLElement => !!h);
      if (ends.length === 2) {
        const line = drawLine(cols, ends[0], ends[1]);
        await wait(420);
        void line;
      }
    }
    if (isWild()) {
      columns.forEach((c, i) =>
        anim(c, [{ transform: "none" }, { transform: `rotate(${i ? -3 : 3}deg) translateX(${i ? -6 : 6}px)` }, { transform: "none" }], {
          duration: 500,
          easing: SPRING,
        }),
      );
    }
  }

  if (!burst || !section.isConnected) return;
  burst.style.opacity = "";
  void anim(
    burst,
    [
      { transform: "scale(0) rotate(-120deg)", opacity: 1 },
      { transform: `scale(${calm ? 1 : 1.15}) rotate(8deg)`, opacity: 1, offset: 0.7 },
      { transform: "scale(1) rotate(0)", opacity: 1 },
    ],
    { duration: calm ? 240 : 560, easing: "ease-out", fill: "backwards" },
  );
  if (calm) return;
  await wait(380);
  if (!section.isConnected) return;
  const c = center(burst);
  sparkles(c.x, c.y, { count: 16, distance: 110 });
  sfx("both", c.x, c.y - 80);
  flare();
}

export function BothLands({ both, children }: { both: boolean; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  // Decided at mount: a refresh that changes the verdict never replays (or starts) it.
  const bothAtMount = useRef(both);

  useEffect(() => {
    const host = ref.current;
    const section = host?.firstElementChild as HTMLElement | null;
    if (!host || !section) return;
    if (!bothAtMount.current || isReduced()) {
      host.dataset.landed = "done";
      return;
    }
    host.dataset.landed = "wait";
    const stop = watchFirstSight([section], {
      onSeen: () => void land(section),
      onPassed: () => {
        host.dataset.landed = "done";
      },
      marginPercent: 15,
    });
    return () => {
      stop();
      if (host.dataset.landed === "wait") host.dataset.landed = "done";
    };
  }, []);

  return (
    <div ref={ref} data-both-lands={both || undefined} className="contents">
      {children}
    </div>
  );
}
