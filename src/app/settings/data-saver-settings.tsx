"use client";

import { useSyncExternalStore } from "react";
import { getMessages } from "@/lib/i18n";
import {
  applyDataSaver,
  canDetectConnection,
  DATA_SAVER_MODES,
  isSavingData,
  onConnectionChange,
  savedDataSaver,
  type DataSaverMode,
} from "@/lib/data-saver";

const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  const removeConnection = onConnectionChange(listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
    removeConnection();
  };
}

/** What to say under "Auto": nothing on the server, where the connection isn't known. */
function autoStatus(): "saving" | "cantDetect" | null {
  if (!canDetectConnection()) return "cantDetect";
  return isSavingData("auto") ? "saving" : null;
}

/** Auto, on or off, for this device only. The service worker does the work (see src/lib/data-saver.ts). */
export function DataSaverSettings({ language }: { language: string }) {
  // "auto" on the server; the saved choice once hydrated.
  const mode = useSyncExternalStore(subscribe, savedDataSaver, () => "auto" as DataSaverMode);
  const status = useSyncExternalStore(subscribe, autoStatus, () => null);
  const t = getMessages(language).account.dataSaver;

  function choose(next: DataSaverMode) {
    applyDataSaver(next);
    listeners.forEach((listener) => listener());
  }

  return (
    <fieldset className="grid gap-2">
      <legend className="sr-only">{t.heading}</legend>
      <div className="flex flex-wrap gap-2">
        {DATA_SAVER_MODES.map((option) => (
          <label
            key={option}
            className="chip cursor-pointer px-4 has-focus-visible:outline-3 has-focus-visible:outline-offset-3 has-focus-visible:outline-accent"
          >
            <input
              type="radio"
              name="dataSaver"
              value={option}
              checked={mode === option}
              onChange={() => choose(option)}
              className="sr-only"
            />
            {t.options[option]}
          </label>
        ))}
      </div>
      {mode === "auto" && status && <p className="font-medium text-muted">{status === "saving" ? t.savingNow : t.cantDetect}</p>}
    </fieldset>
  );
}
