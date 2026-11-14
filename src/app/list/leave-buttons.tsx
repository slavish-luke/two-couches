"use client";

import { useState, useTransition } from "react";
import { CheckIcon, CloseIcon } from "@/components/icons";
import { getMessages } from "@/lib/i18n";
import { leaveList, type LeaveKind } from "@/lib/list-motion";
import { updateListItem } from "./actions";

/**
 * Sprint 26: "Watched" and "Drop" on a Home Up next card. The save starts at once; meanwhile a rubber stamp
 * slams onto the card and it slides off into the Watched tab, or it tips over and falls off the bottom
 * (src/lib/list-motion.ts). A failed save puts the card back with the error. The other screen follows
 * through ListSync.
 */
export function LeaveButtons({ itemId, title, language }: { itemId: string; title: string; language: string }) {
  const t = getMessages(language).list;
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();

  function leave(kind: LeaveKind, button: HTMLElement) {
    const card = button.closest<HTMLElement>("[data-list-card]");
    const watchedTab = document.querySelector<HTMLElement>('a[data-deal-tab="home"][data-deal-to="watched"]');
    const motion = card ? leaveList(card, kind, t.stamp[kind], watchedTab) : null;
    setError(undefined);
    startTransition(async () => {
      const result = await updateListItem(itemId, { status: kind });
      motion?.done(!result.error);
      setError(result.error);
    });
  }

  // On phones they're just their icons (the label is read out), so the row stays short.
  const quiet = "btn-quiet tap-area px-2.5 py-0.5 text-sm disabled:opacity-60";
  return (
    <span className="relative z-10 flex flex-wrap items-center gap-1.5">
      <button
        type="button"
        data-leave="watched"
        title={t.leave.watched}
        aria-label={t.leave.watchedLabel(title)}
        disabled={pending}
        onClick={(e) => leave("watched", e.currentTarget)}
        className={quiet}
      >
        <CheckIcon className="size-4" />
        <span className="max-sm:hidden">{t.leave.watched}</span>
      </button>
      <button
        type="button"
        data-leave="dropped"
        title={t.leave.drop}
        aria-label={t.leave.dropLabel(title)}
        disabled={pending}
        onClick={(e) => leave("dropped", e.currentTarget)}
        className={quiet}
      >
        <CloseIcon className="size-3.5" />
        <span className="max-sm:hidden">{t.leave.drop}</span>
      </button>
      {error && (
        <span role="alert" className="basis-full text-xs font-semibold text-danger">
          {error}
        </span>
      )}
    </span>
  );
}
