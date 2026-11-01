"use client";

import { useState, useTransition } from "react";
import { dismissTitle } from "@/app/browse/actions";
import { getMessages } from "@/lib/i18n";
import type { TitleRef } from "@/lib/watch";

/** Toggles "not interested" for the couple, which keeps a title out of their suggestions. */
export function DismissButton({
  titleRef,
  dismissed,
  language,
  long = false,
}: {
  titleRef: TitleRef;
  dismissed: boolean;
  language: string;
  /** Full-size, for the title page. */
  long?: boolean;
}) {
  const [saving, startSaving] = useTransition();
  const [error, setError] = useState<string>();
  const t = getMessages(language).common.dismiss;

  return (
    <span className="grid justify-items-start gap-1">
      <button
        aria-pressed={dismissed}
        title={dismissed ? t.undo : undefined}
        disabled={saving}
        onClick={() =>
          startSaving(async () => {
            const result = await dismissTitle(titleRef, !dismissed);
            setError(result.error);
          })
        }
        className={long ? "btn-quiet text-sm" : "text-xs font-semibold text-muted hover:text-ink disabled:opacity-50"}
      >
        {saving ? t.saving : dismissed ? t.dismissed : t.notInterested}
      </button>
      {error && (
        <span role="alert" className="text-xs text-danger">
          {error}
        </span>
      )}
    </span>
  );
}
