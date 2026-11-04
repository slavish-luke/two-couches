"use client";

import { useEffect, useSyncExternalStore } from "react";
import { sendDataSaver } from "@/lib/data-saver";

/** Chrome's install prompt event (not in TypeScript's DOM types). */
type InstallPromptEvent = Event & { prompt(): Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

/** iPhone or iPad (iPadOS reports itself as a Mac with a touch screen). */
export function isAppleMobile() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
}

/** Running as an installed app rather than in a browser tab. */
export function isInstalled() {
  return window.matchMedia("(display-mode: standalone)").matches || ("standalone" in navigator && navigator.standalone === true);
}

/** Registers the service worker (public/sw.js). Caching is off in next dev, where files change in place. */
export function registerServiceWorker() {
  const url = process.env.NODE_ENV === "production" ? "/sw.js" : "/sw.js?dev";
  return navigator.serviceWorker.register(url, { scope: "/", updateViaCache: "none" });
}

/** Tells the service worker to drop the offline copy of the list. Called before signing out. */
export async function forgetOfflineCopies() {
  if (!("serviceWorker" in navigator)) return;
  const registration = await navigator.serviceWorker.getRegistration();
  registration?.active?.postMessage("forget");
}

let installPrompt: InstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Whether the browser offered to install the app, and a function that shows its prompt. Null otherwise. */
export function useInstallPrompt() {
  const event = useSyncExternalStore(subscribe, () => installPrompt, () => null);
  if (!event) return null;
  return async () => {
    await event.prompt();
    // Each prompt can be shown once.
    installPrompt = null;
    notify();
  };
}

/**
 * Rendered once in the root layout: registers the service worker (and passes it this device's data saver
 * choice, in case it was reinstalled since), keeps the browser's install prompt
 * (which fires once, possibly before Settings is opened) for useInstallPrompt(). Renders nothing.
 */
export function PwaSetup() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      registerServiceWorker().catch((error) => console.error("Registering the service worker failed", error));
      sendDataSaver().catch((error) => console.error("Telling the service worker about data saver failed", error));
    }
    const keep = (event: Event) => {
      event.preventDefault();
      installPrompt = event as InstallPromptEvent;
      notify();
    };
    const installed = () => {
      installPrompt = null;
      notify();
    };
    window.addEventListener("beforeinstallprompt", keep);
    window.addEventListener("appinstalled", installed);
    return () => {
      window.removeEventListener("beforeinstallprompt", keep);
      window.removeEventListener("appinstalled", installed);
    };
  }, []);
  return null;
}
