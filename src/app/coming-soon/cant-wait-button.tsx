"use client";

import { useOptimistic, useState, useTransition } from "react";
import { getMessages } from "@/lib/i18n";
import type { TitleRef } from "@/lib/watch";
import { setCantWait } from "./actions";

/**
 * "Can't wait" on a Coming soon card: toggles your own mark, and shows both people's (a dot in each
 * person's colour, filled once they've marked it). Once you both have, the title sorts to the front of
 * its row and the couple gets a reminder.
 */
export function CantWaitButton(props: {
  titleRef: TitleRef;
  mine: boolean;
  theirs: boolean;
  /** Null before pairing up: then there's only your dot. */
  partnerName: string | null;
  language: string;
  /** Said after the label for screen readers, so a row of these says which title each one is for. */
  titleName?: string;
}) {
  const t = getMessages(props.language).discovery.cantWait;
  const [mine, setMine] = useOptimistic(props.mine);
  const [, startSaving] = useTransition();
  const [error, setError] = useState<string>();
  const [both, setBoth] = useState(false);

  const names = [mine ? t.you : null, props.theirs ? props.partnerName : null].filter(Boolean).join(", ");
  return (
    <span className="grid justify-items-start gap-1">
      <button
        aria-pressed={mine}
        title={names ? t.marked(names) : t.nobody}
        onClick={() =>
          startSaving(async () => {
            setMine(!mine);
            const result = await setCantWait(props.titleRef, !mine);
            setError(result.error);
            setBoth(Boolean(result.both));
          })
        }
        data-cant-wait
        // relative: keeps the sr-only text inside the card, or it escapes the scrolling row and widens the page.
        className="btn-quiet relative px-2.5 py-0.5 text-sm aria-pressed:bg-accent-soft"
      >
        <span aria-hidden className="flex -space-x-1">
          <span className={`size-3 rounded-full border-2 border-outline ${mine ? "bg-me" : "bg-surface"}`} />
          {props.partnerName !== null && (
            <span className={`size-3 rounded-full border-2 border-outline ${props.theirs ? "bg-partner" : "bg-surface"}`} />
          )}
        </span>
        {t.button}
        {props.titleName && <span className="sr-only">: {props.titleName}</span>}
        {names && <span className="sr-only">. {t.marked(names)}</span>}
      </button>
      {both && mine && props.theirs && (
        <span role="status" className="text-xs font-semibold">
          {t.both}
        </span>
      )}
      {error && (
        <span role="alert" className="text-xs font-semibold text-danger">
          {error}
        </span>
      )}
    </span>
  );
}
