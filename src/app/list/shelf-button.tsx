"use client";

import { useState, useTransition } from "react";
import { ArrowIcon, ShelfIcon } from "@/components/icons";
import { getMessages } from "@/lib/i18n";
import { moveShelf } from "./shelf-actions";

/**
 * One tap between Up next and the Someday shelf, on a Home list card (`compact`) or the title page. The
 * other screen follows through ListSync.
 */
export function ShelfButton({
  itemId,
  title,
  onShelf,
  language,
  compact = false,
}: {
  itemId: string;
  title: string;
  onShelf: boolean;
  language: string;
  compact?: boolean;
}) {
  const t = getMessages(language).shelf.shelf;
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  const label = onShelf ? t.toNextLabel(title) : t.toShelfLabel(title);

  return (
    <span className="relative z-10 grid justify-items-start gap-1">
      <button
        type="button"
        data-shelf-button
        aria-label={compact ? label : undefined}
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await moveShelf(itemId, onShelf ? "next" : "someday");
            setError(result.error);
          })
        }
        className={`btn-quiet ${compact ? "tap-area px-2.5 py-0.5 text-sm" : "text-sm"} disabled:opacity-60`}
      >
        {onShelf ? <ArrowIcon className="size-4 -rotate-90" /> : <ShelfIcon className="size-4" />}
        {compact ? (onShelf ? t.toNext : t.toShelf) : onShelf ? t.moveBack : t.putAway}
      </button>
      {error && (
        <span role="alert" className="text-xs font-semibold text-danger">
          {error}
        </span>
      )}
    </span>
  );
}
