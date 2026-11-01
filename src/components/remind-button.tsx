"use client";

import { useState, useTransition } from "react";
import { setReminder } from "@/app/coming-soon/actions";
import { getMessages } from "@/lib/i18n";
import type { TitleRef } from "@/lib/watch";

/** Toggles the couple's "tell us when it's streaming" reminder. `long` spells it out, for the title page. */
export function RemindButton({
  titleRef,
  reminded,
  language,
  long = false,
}: {
  titleRef: TitleRef;
  reminded: boolean;
  language: string;
  long?: boolean;
}) {
  const [saving, startSaving] = useTransition();
  const [error, setError] = useState<string>();
  const t = getMessages(language).upcoming.reminders;

  return (
    <span className="grid justify-items-start gap-1">
      <button
        aria-pressed={reminded}
        title={reminded ? t.stop : undefined}
        disabled={saving}
        onClick={() =>
          startSaving(async () => {
            const result = await setReminder(titleRef, !reminded);
            setError(result.error);
          })
        }
        className={`btn-quiet text-sm ${long ? "" : "px-3 py-1"} ${reminded ? "border-both text-both" : ""}`}
      >
        {saving ? t.saving : reminded ? t.on : long ? t.remindLong : t.remind}
      </button>
      {error && (
        <span role="alert" className="text-xs text-danger">
          {error}
        </span>
      )}
    </span>
  );
}
