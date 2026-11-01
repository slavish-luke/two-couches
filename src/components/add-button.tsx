"use client";

import { useState, useTransition } from "react";
import { addToList } from "@/app/list/actions";
import type { TitleRef } from "@/lib/watch";

/** One-tap "add to our list" for search results. Becomes a quiet "On our list" once it's there. */
export function AddButton({ titleRef, onList }: { titleRef: TitleRef; onList: boolean }) {
  const [adding, startAdding] = useTransition();
  const [error, setError] = useState<string>();

  if (onList) {
    return <span className="text-sm font-semibold text-both">✓ On our list</span>;
  }
  return (
    <span className="grid justify-items-end gap-1">
      <button
        className="btn-quiet px-3 py-1 text-sm"
        disabled={adding}
        onClick={() =>
          startAdding(async () => {
            const result = await addToList(titleRef);
            setError(result.error);
          })
        }
      >
        {adding ? "Adding…" : "+ Add"}
      </button>
      {error && (
        <span role="alert" className="text-xs text-danger">
          {error}
        </span>
      )}
    </span>
  );
}
