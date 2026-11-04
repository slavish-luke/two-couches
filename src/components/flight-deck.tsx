"use client";

import { getMessages } from "@/lib/i18n";
import { registerDeck } from "@/lib/flight";
import { SECTIONS, type Section } from "./app-nav";

/**
 * The flight layer over the page (src/lib/flight.ts): speed lines and, for each section, a lightweight
 * preview that riffles past when a page transition skips over it. Empty and see-through between flights.
 * It is its own view-transition group ("flight"), so it moves live above or between the page snapshots.
 */
export function FlightDeck({ language }: { language: string }) {
  const t = getMessages(language).common.nav;
  return (
    <div
      ref={registerDeck}
      aria-hidden
      style={{ viewTransitionName: "flight" }}
      className="pointer-events-none fixed inset-0 z-[5] overflow-hidden"
    >
      <div
        data-speed-lines
        className="absolute inset-0 opacity-0 bg-[repeating-linear-gradient(0deg,transparent_0_22px,rgb(29_26_43/0.13)_22px_25px,transparent_25px_61px,rgb(255_250_240/0.55)_61px_66px,transparent_66px_97px)] data-[strong=true]:bg-[repeating-linear-gradient(0deg,transparent_0_14px,rgb(29_26_43/0.2)_14px_18px,transparent_18px_40px,rgb(255_250_240/0.67)_40px_47px,transparent_47px_70px)]"
      />
      {SECTIONS.map(({ key }, i) => (
        <div
          key={key}
          data-section={i}
          className="absolute inset-0 opacity-0 in-data-[flight=peel]:bg-bg in-data-[flight=peel]:bg-[repeating-conic-gradient(from_0deg_at_50%_-10%,var(--ray)_0_6deg,transparent_6deg_12deg)] in-data-[flight=peel]:shadow-[-16px_0_28px_-12px_rgb(29_26_43/0.35)]"
        >
          <div className="mx-auto grid max-w-[90rem] gap-6 px-4 pt-24 sm:px-6 lg:px-8 lg:pt-28">
            <p className="display text-[clamp(3.5rem,9vw,6rem)]">{t[key]}</p>
            <Preview section={key} />
          </div>
        </div>
      ))}
    </div>
  );
}

/** A few blank paper shapes in the section's own layout. */
function Preview({ section }: { section: Section }) {
  const paper = "rounded-panel border-[3px] border-outline bg-surface shadow-[5px_5px_0_var(--outline)]";
  const poster = "aspect-[2/3] rounded-poster border-[3px] border-outline bg-accent-soft shadow-[4px_4px_0_var(--outline)]";
  switch (section) {
    case "list":
      return (
        <div className="grid max-w-3xl gap-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className={`flex h-28 gap-4 p-3 ${paper} ${i % 2 ? "rotate-[0.6deg]" : "-rotate-[0.5deg]"}`}>
              <div className={`h-full ${poster} shadow-none`} />
            </div>
          ))}
        </div>
      );
    case "browse":
      return (
        <div className="grid grid-cols-3 gap-5 sm:grid-cols-6">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className={poster} />
          ))}
        </div>
      );
    case "comingSoon":
      return (
        <div className="grid grid-cols-2 gap-5 sm:grid-cols-4">
          {["bg-me", "bg-partner", "bg-pop", "bg-accent"].map((fill) => (
            <div key={fill} className={`grid gap-3 p-3 ${paper}`}>
              <div className={`h-20 rounded-control border-[3px] border-outline ${fill}`} />
              <div className="h-4 w-2/3 rounded-full bg-outline/15" />
            </div>
          ))}
        </div>
      );
    case "watchNights":
      return (
        <div className="grid max-w-3xl gap-5">
          {[0, 1].map((i) => (
            <div key={i} className={`h-36 ${paper} bg-accent ${i ? "rotate-1" : "-rotate-1"}`} />
          ))}
        </div>
      );
    case "stats":
      return (
        <div className={`flex h-48 max-w-3xl items-end gap-4 p-5 ${paper}`}>
          {[40, 70, 55, 90, 30, 65].map((height) => (
            <div key={height} className="flex-1 rounded-t-control border-[3px] border-outline bg-accent" style={{ height: `${height}%` }} />
          ))}
        </div>
      );
  }
}
