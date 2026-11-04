"use client";

import { useOffline } from "next/offline";
import { getMessages } from "@/lib/i18n";

/**
 * A tag by the logo while there's no connection. Next.js holds navigations and saves until it's back,
 * then retries them; the full sentence says so (as a tooltip and to screen readers).
 */
export function OfflineChip({ language }: { language: string }) {
  const isOffline = useOffline();
  if (!isOffline) return null;
  const t = getMessages(language).common;
  return (
    <p
      role="status"
      title={t.offline}
      className="mr-auto inline-flex -rotate-3 items-center gap-1.5 whitespace-nowrap rounded-full border-2 border-outline bg-surface px-2.5 py-0.5 text-xs font-bold text-ink shadow-[2px_2px_0_var(--outline)]"
    >
      <span aria-hidden className="size-2 rounded-full border-[1.5px] border-outline bg-danger" />
      <span aria-hidden>{t.offlineShort}</span>
      <span className="sr-only">{t.offline}</span>
    </p>
  );
}
