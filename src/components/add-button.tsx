"use client";

import { useState, useTransition } from "react";
import { addToList } from "@/app/list/actions";
import { getMessages } from "@/lib/i18n";
import type { TitleRef } from "@/lib/watch";
import { CheckIcon, PlusIcon } from "./icons";

/** One-tap "add to our list" for search results. Becomes a quiet "On our list" once it's there. */
export function AddButton({ titleRef, onList, language }: { titleRef: TitleRef; onList: boolean; language: string }) {
  const [adding, startAdding] = useTransition();
  const [error, setError] = useState<string>();
  const t = getMessages(language).common.add;

  if (onList) {
    return (
      <span className="inline-flex items-center gap-1 text-sm font-semibold text-muted">
        <CheckIcon />
        {t.onList}
      </span>
    );
  }
  return (
    <span className="grid justify-items-end gap-1">
      <button
        className="btn-quiet px-2.5 py-0.5 text-sm"
        disabled={adding}
        onClick={() =>
          startAdding(async () => {
            const result = await addToList(titleRef);
            setError(result.error);
          })
        }
      >
        {adding ? (
          t.adding
        ) : (
          <>
            <PlusIcon className="size-3.5" />
            {t.add}
          </>
        )}
      </button>
      {error && (
        <span role="alert" className="text-xs text-danger">
          {error}
        </span>
      )}
    </span>
  );
}
