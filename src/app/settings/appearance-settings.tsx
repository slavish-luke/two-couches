"use client";

import { useSyncExternalStore } from "react";
import { burstPath } from "@/components/burst";
import { ChoiceTile } from "@/components/choice-tile";
import { Couch } from "@/components/couch";
import { getMessages } from "@/lib/i18n";
import { applyLook, DEFAULT_LOOK, PALETTE_COLORS, savedLook, SKINS, type Look, type Palette, type Skin } from "@/lib/theme";

const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

// useSyncExternalStore compares snapshots by identity, so the saved look is read as one string.
const lookKey = () => {
  const { skin, palette } = savedLook();
  return `${skin}/${palette}`;
};

const SWATCH_BURST = burstPath(10, 46, 30, 50, 50);

/** A tiny scene in a palette's own colours: its ground, a paper panel, the two couches and the burst. */
function Swatch({ palette, className = "" }: { palette: Palette; className?: string }) {
  const c = PALETTE_COLORS[palette];
  return (
    <span
      aria-hidden
      className={`relative block overflow-hidden rounded-control border-[3px] border-outline ${className}`}
      style={{ background: c.ground }}
    >
      <span
        className="absolute inset-x-3 bottom-3 top-6 rounded-[10px] border-[2.5px]"
        style={{ background: c.paper, borderColor: c.ink }}
      />
      <span className="absolute left-4 top-2.5 h-3 w-14 rounded-full" style={{ background: c.accent }} />
      <svg viewBox="0 0 100 100" className="absolute bottom-1 right-1.5 size-10 rotate-12">
        <path d={SWATCH_BURST} fill={c.both} stroke={c.ink} strokeWidth={6} strokeLinejoin="round" />
      </svg>
    </span>
  );
}

/** Look (the skin) and Colours (its palette), for this device only. */
export function AppearanceSettings({ language }: { language: string }) {
  // The standard look on the server; the saved one once hydrated.
  const key = useSyncExternalStore(subscribe, lookKey, () => `${DEFAULT_LOOK.skin}/${DEFAULT_LOOK.palette}`);
  const [skin, palette] = key.split("/") as [Skin, Palette];
  const t = getMessages(language).account.appearance;

  function choose(next: Look) {
    applyLook(next);
    listeners.forEach((listener) => listener());
  }

  const option = "grid gap-2 rounded-panel border-[3px] p-2 has-checked:shadow-[4px_4px_0_var(--outline)]";

  return (
    <div className="grid gap-5">
      <p className="text-muted">{t.intro}</p>
      <fieldset className="grid gap-2.5">
        <legend className="mb-2.5 font-bold">{t.look}</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {(Object.keys(SKINS) as Skin[]).map((option_) => (
            <ChoiceTile
              key={option_}
              type="radio"
              name="skin"
              value={option_}
              checked={skin === option_}
              onChange={() => choose({ skin: option_, palette: SKINS[option_][0] })}
              className={option}
            >
              {/* Drawn in the skin's own standard look: a skin restyles .look-preview[data-skin=…] in globals.css. */}
              <span
                aria-hidden
                data-skin={option_}
                data-palette={SKINS[option_][0]}
                className="look-preview relative flex h-24 items-end justify-center gap-1 overflow-hidden rounded-control border-[3px] border-outline bg-pop bg-[repeating-conic-gradient(from_0deg_at_50%_-10%,var(--ray)_0_6deg,transparent_6deg_12deg)] pb-2"
              >
                <Couch who="me" size={50} />
                <Couch who="partner" size={50} />
              </span>
              <span className="grid px-1 pb-0.5 leading-tight">
                <span className="font-bold">{t.skins[option_]}</span>
                <span className="text-sm opacity-85">{t.skinNotes[option_]}</span>
              </span>
            </ChoiceTile>
          ))}
        </div>
      </fieldset>
      <fieldset className="grid gap-2.5">
        <legend className="mb-2.5 font-bold">{t.colours}</legend>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {SKINS[skin].map((option_) => (
            <ChoiceTile
              key={option_}
              type="radio"
              name="palette"
              value={option_}
              checked={palette === option_}
              onChange={() => choose({ skin, palette: option_ })}
              className={option}
            >
              <Swatch palette={option_} className="h-16" />
              <span className="px-1 pb-0.5 text-sm font-bold leading-tight">{t.palettes[option_]}</span>
            </ChoiceTile>
          ))}
        </div>
      </fieldset>
    </div>
  );
}
