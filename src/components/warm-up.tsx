"use client";

import { useEffect } from "react";

/** How often one device asks. TMDB lists are cached for 6 hours and availability for a day. */
const EVERY_MS = 30 * 60 * 1000;
const STORAGE_KEY = "warmedAt";

/**
 * Once the app has opened and the browser is idle, asks the server to fill the caches behind Browse and
 * Coming soon (/api/warm, see warmCaches()), so those pages are quick when opened. The server does the
 * work, so this costs the device one small request. Rendered once in the root layout; renders nothing.
 */
export function WarmUp() {
  useEffect(() => {
    if (!navigator.onLine) return;
    try {
      if (Date.now() - Number(localStorage.getItem(STORAGE_KEY) ?? 0) < EVERY_MS) return;
      localStorage.setItem(STORAGE_KEY, String(Date.now()));
    } catch {
      // Private browsing can refuse storage; warming every load is harmless.
    }
    const warm = () => {
      fetch("/api/warm", { method: "POST" }).catch(() => {});
    };
    if ("requestIdleCallback" in window) {
      const id = requestIdleCallback(warm, { timeout: 5000 });
      return () => cancelIdleCallback(id);
    }
    const id = setTimeout(warm, 2000);
    return () => clearTimeout(id);
  }, []);
  return null;
}
