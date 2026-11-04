/**
 * Data saver: smaller posters, chosen per device in Settings and kept in localStorage ("auto" removes it).
 * The service worker (public/sw.js) does the work, since it already handles every poster request, so the
 * choice is also sent to it. Browser-only apart from the constants.
 */

export const DATA_SAVER_MODES = ["auto", "on", "off"] as const;

export type DataSaverMode = (typeof DATA_SAVER_MODES)[number];

const STORAGE_KEY = "dataSaver";

/** Connection types slow enough for "auto" to save data. Keep in step with SLOW in public/sw.js. */
const SLOW = ["slow-2g", "2g", "3g"];

/** What Chromium browsers say about the connection (not in TypeScript's DOM types; Safari has none). */
type Connection = EventTarget & { saveData?: boolean; effectiveType?: string };

function connection(): Connection | undefined {
  return (navigator as Navigator & { connection?: Connection }).connection;
}

/** Whether this browser tells pages about the connection, which "auto" needs. */
export function canDetectConnection() {
  return connection() !== undefined;
}

/** Calls `listener` when the connection's speed or save-data flag changes. Returns the unsubscribe. */
export function onConnectionChange(listener: () => void) {
  const info = connection();
  info?.addEventListener("change", listener);
  return () => info?.removeEventListener("change", listener);
}

export function savedDataSaver(): DataSaverMode {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === "on" || value === "off" ? value : "auto";
  } catch {
    return "auto";
  }
}

/** Whether posters come smaller on this device right now. Keep in step with savingData() in public/sw.js. */
export function isSavingData(mode = savedDataSaver()) {
  if (mode !== "auto") return mode === "on";
  const info = connection();
  return Boolean(info && (info.saveData || SLOW.includes(info.effectiveType ?? "")));
}

/** Passes the saved choice to the service worker, which keeps its own copy (it can't read localStorage). */
export async function sendDataSaver(mode = savedDataSaver()) {
  if (!("serviceWorker" in navigator)) return;
  const registration = await navigator.serviceWorker.ready;
  registration.active?.postMessage({ dataSaver: mode });
}

/** Switches this device to a mode and remembers it. Posters already shown keep their size until reloaded. */
export function applyDataSaver(mode: DataSaverMode) {
  try {
    if (mode === "auto") localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // Private browsing can refuse storage; the service worker still gets the choice.
  }
  sendDataSaver(mode).catch((error) => console.error("Telling the service worker about data saver failed", error));
}
