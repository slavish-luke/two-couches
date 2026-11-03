"use client";

import { useSyncExternalStore } from "react";
import { isAppleMobile, isInstalled, useInstallPrompt } from "@/components/pwa";
import { getMessages } from "@/lib/i18n";

const noSubscription = () => () => {};

/** How to put the app on this device's Home Screen: the browser's own prompt, iPhone steps, or a hint. */
export function InstallSettings({ language }: { language: string }) {
  const install = useInstallPrompt();
  // Null while server rendering; the device is only known in the browser.
  const device = useSyncExternalStore(
    noSubscription,
    () => (isInstalled() ? "installed" : isAppleMobile() ? "ios" : "other"),
    () => null,
  );
  const t = getMessages(language).account.install;

  if (!device) return null;
  if (device === "installed") return <p className="text-sm text-both">{t.installed}</p>;
  if (install) {
    return (
      <button type="button" onClick={install} className="btn justify-self-start">
        {t.button}
      </button>
    );
  }
  return <p className="text-sm text-muted">{device === "ios" ? t.ios : t.other}</p>;
}
