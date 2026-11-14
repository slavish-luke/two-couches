"use client";

import { useLayoutEffect, useRef } from "react";
import { getMessages } from "@/lib/i18n";
import { landVerdict, starsLandMs, verdictFor } from "@/lib/list-motion";

/** The ratings pair each verdict last showed on this device, by `memory` key. */
const seen = new Map<string, string>();

/**
 * Once you've both rated something: "Same!" (on the burst colour), "Close!" (1 star apart) or "Ooh, a
 * split" (2 or more), as a sticker beside the stars. It lands with a slap (or a wobble) each time either
 * rating changes while you're looking; the first time it's shown it's simply there. Read out politely when
 * it changes. Don't render it while "Guess first?" veils your partner's rating.
 *
 * `memory` names the pair (e.g. the list item's id); `host` (a selector for the closest panel) jolts on "Same!".
 */
export function RatingVerdict({
  memory,
  mine,
  theirs,
  language,
  host,
}: {
  memory: string;
  mine: number | null | undefined;
  theirs: number | null | undefined;
  language: string;
  host?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const verdict = verdictFor(mine, theirs);
  const pair = `${mine ?? 0}:${theirs ?? 0}`;
  const t = getMessages(language).title.cheer;

  useLayoutEffect(() => {
    const before = seen.get(memory);
    seen.set(memory, pair);
    const sticker = ref.current;
    if (before === undefined || before === pair || !verdict || !sticker) return;
    // A partner's rating drops in star by star first (LiveStars): land after it. Yours lands straight away.
    const theirsChanged = before.split(":")[1] !== pair.split(":")[1];
    void landVerdict(sticker, verdict, host ? sticker.closest<HTMLElement>(host) : null, theirsChanged ? starsLandMs(theirs ?? 0) : 0);
  }, [memory, pair, verdict, host, theirs]);

  return (
    <>
      <span role="status" className="sr-only">
        {verdict && t[verdict]}
      </span>
      {verdict && (
        <span ref={ref} aria-hidden data-verdict={verdict} className="lm-verdict">
          {t[verdict]}
        </span>
      )}
    </>
  );
}
