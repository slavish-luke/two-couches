"use client";

import { useOptimistic, useState, useTransition } from "react";
import { NameTag } from "@/components/name-tag";
import { getMessages } from "@/lib/i18n";
import { MOODS, type Mood } from "@/lib/pick-rules";
import { setMood } from "./actions";
import { MoodIcon } from "./mood-icons";

/**
 * Today's mood check-in: five drawn moods to tap (tap yours again to clear it), with your partner's beside
 * it. Picking one deals the pick (or the swipe deck) again, leaning towards genres that suit you both.
 */
export function MoodCheck({
  mine,
  theirs,
  partnerName,
  language,
}: {
  mine: Mood | null;
  theirs: Mood | null;
  /** Null until your partner has joined. */
  partnerName: string | null;
  language: string;
}) {
  const t = getMessages(language).pick.mood;
  const [shown, setShown] = useOptimistic(mine);
  const [saving, startSaving] = useTransition();
  const [failed, setFailed] = useState(false);

  function choose(mood: Mood) {
    const next = shown === mood ? null : mood;
    startSaving(async () => {
      setShown(next);
      const result = await setMood(next);
      setFailed(!result.ok);
    });
  }

  return (
    <section data-mood-check aria-labelledby="mood-heading" aria-busy={saving || undefined} className="card grid gap-3">
      <h2 id="mood-heading" className="display-ink text-2xl">
        {t.heading}
      </h2>
      <div role="group" aria-labelledby="mood-heading" className="flex flex-wrap gap-2">
        {MOODS.map((mood) => (
          <button key={mood} type="button" className="chip" aria-pressed={shown === mood} onClick={() => choose(mood)}>
            <MoodIcon mood={mood} />
            {t.names[mood]}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[15px] font-semibold">
        {shown && (
          <span className="flex min-w-0 items-center gap-2">
            <NameTag who="me" name={t.you} />
            <MoodIcon mood={shown} />
            {t.names[shown]}
          </span>
        )}
        {partnerName && (
          <span className="flex min-w-0 items-center gap-2">
            <NameTag who="partner" name={partnerName} />
            {theirs ? (
              <>
                <MoodIcon mood={theirs} />
                <span className="sr-only">{t.partner(partnerName, t.names[theirs])}</span>
                <span aria-hidden>{t.names[theirs]}</span>
              </>
            ) : (
              <span className="text-muted">{t.notYet}</span>
            )}
          </span>
        )}
      </div>
      <p className="text-sm text-muted">{t.hint}</p>
      {failed && (
        <p role="alert" className="text-sm font-semibold text-danger">
          {t.failed}
        </p>
      )}
    </section>
  );
}
