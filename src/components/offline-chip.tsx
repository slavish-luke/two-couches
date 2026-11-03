"use client";

import { useOffline } from "next/offline";
import { getMessages } from "@/lib/i18n";

/**
 * A chip by the logo while there's no connection. Next.js holds navigations and saves until it's back,
 * then retries them; the full sentence says so (as a tooltip and to screen readers).
 */
export function OfflineChip({ language }: { language: string }) {
  const isOffline = useOffline();
  if (!isOffline) return null;
  const t = getMessages(language).common;
  return (
    <p role="status" title={t.offline} className="mr-auto rounded-full bg-ink px-2.5 py-0.5 text-xs font-semibold text-bg">
      <span aria-hidden>{t.offlineShort}</span>
      <span className="sr-only">{t.offline}</span>
    </p>
  );
}
