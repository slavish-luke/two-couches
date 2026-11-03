"use client";

import { useSyncExternalStore } from "react";
import { getMessages } from "@/lib/i18n";
import { applyTheme, savedTheme, THEMES, type Theme } from "@/lib/theme";

const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

/** System, light or dark, for this device only. */
export function AppearanceSettings({ language }: { language: string }) {
  // "system" on the server; the saved choice once hydrated.
  const theme = useSyncExternalStore(subscribe, savedTheme, () => "system" as Theme);
  const t = getMessages(language).account.appearance;

  function choose(next: Theme) {
    applyTheme(next);
    listeners.forEach((listener) => listener());
  }

  return (
    <fieldset className="grid gap-2">
      <legend className="sr-only">{t.heading}</legend>
      <div className="flex flex-wrap gap-2">
        {THEMES.map((option) => (
          <label
            key={option}
            className="cursor-pointer rounded-full border border-line px-4 py-1.5 text-sm font-semibold text-muted transition hover:text-ink has-checked:border-ink has-checked:bg-ink has-checked:text-bg has-focus-visible:ring-2 has-focus-visible:ring-partner/40"
          >
            <input
              type="radio"
              name="theme"
              value={option}
              checked={theme === option}
              onChange={() => choose(option)}
              className="sr-only"
            />
            {t.options[option]}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
