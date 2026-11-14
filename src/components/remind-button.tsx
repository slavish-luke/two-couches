"use client";

import { useState, useTransition } from "react";
import { setReminder } from "@/app/coming-soon/actions";
import { getMessages } from "@/lib/i18n";
import type { TitleRef } from "@/lib/watch";
import { CheckIcon } from "./icons";

/** Toggles the couple's "tell us when it's streaming" reminder. `long` spells it out, for the title page. */
export function RemindButton({
  titleRef,
  reminded,
  language,
  long = false,
  titleName,
}: {
  titleRef: TitleRef;
  reminded: boolean;
  language: string;
  long?: boolean;
  /** Said after the label for screen readers, for rows of cards where every button looks alike. */
  titleName?: string;
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
        className={`btn-quiet relative text-sm aria-pressed:bg-accent-soft ${long ? "" : "px-2.5 py-0.5"}`}
      >
        {saving ? (
          t.saving
        ) : reminded ? (
          <>
            <CheckIcon className="size-3.5" />
            {t.on}
          </>
        ) : long ? (
          t.remindLong
        ) : (
          t.remind
        )}
        {titleName && <span className="sr-only">: {titleName}</span>}
      </button>
      {error && (
        <span role="alert" className="text-xs font-semibold text-danger">
          {error}
        </span>
      )}
    </span>
  );
}
