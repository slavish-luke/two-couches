"use client";

import { useState, useTransition } from "react";
import { Translatable } from "@/components/translate";
import { Couch } from "@/components/couch";
import { getMessages } from "@/lib/i18n";
import { MAX_ANSWER_LENGTH, type Reveal } from "@/lib/together-rules";
import { answerQuestion } from "./actions";

/**
 * Your answer to a day's question (a form until you've answered, then your answer with "Change") and what you
 * may see of your partner's: that they've answered (under a sheet until you have), or their answer.
 */
export function AnswerBox(props: {
  day: string;
  mine: string | null;
  partner: Reveal<string>;
  partnerName: string;
  language: string;
  /** Smaller type, for the questions page's history. */
  compact?: boolean;
}) {
  const { mine, partner, partnerName, language, compact = false } = props;
  const t = getMessages(language).together.question;
  const [draft, setDraft] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  const showForm = mine === null || editing;
  const value = draft ?? mine ?? "";

  return (
    <div className="grid gap-2.5">
      {showForm ? (
        <form
          aria-busy={pending}
          className="grid gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!value.trim()) return;
            setError(undefined);
            startTransition(async () => {
              const result = await answerQuestion(props.day, value);
              if (result.error) setError(result.error);
              else {
                setDraft(null);
                setEditing(false);
              }
            });
          }}
        >
          <label className="grid gap-1.5">
            <span className="flex items-baseline justify-between gap-2">
              <span className="flex items-center gap-1.5 text-sm font-bold">
                <span aria-hidden className="size-2.5 rounded-full border-2 border-outline bg-me" />
                {t.yours}
              </span>
              <span aria-hidden className="text-xs font-semibold text-muted">
                {t.count(value.length, MAX_ANSWER_LENGTH)}
              </span>
            </span>
            <textarea
              value={value}
              onChange={(e) => setDraft(e.target.value)}
              maxLength={MAX_ANSWER_LENGTH}
              rows={2}
              required
              disabled={pending}
              placeholder={t.placeholder}
              className="field resize-y"
            />
          </label>
          <div className="flex flex-wrap items-center gap-2.5">
            <button className="btn px-4 pb-1.5 pt-2 text-base" disabled={pending || !value.trim()}>
              {pending ? t.saving : t.answer}
            </button>
            {editing && (
              <button
                type="button"
                className="btn-quiet px-3 py-1 text-sm"
                onClick={() => {
                  setEditing(false);
                  setDraft(null);
                }}
              >
                {t.cancel}
              </button>
            )}
          </div>
        </form>
      ) : (
        <figure className="paper grid gap-1 rounded-control border-[3px] border-outline px-3 py-2.5">
          <figcaption className="flex items-baseline justify-between gap-2">
            <span className="flex items-center gap-1.5 text-sm font-bold">
              <span aria-hidden className="size-2.5 rounded-full border-2 border-outline bg-me" />
              {t.yours}
            </span>
            <button type="button" onClick={() => setEditing(true)} className="tap-area text-sm font-bold underline underline-offset-4">
              {t.change}
            </button>
          </figcaption>
          <blockquote className={`font-medium [overflow-wrap:anywhere] ${compact ? "" : "text-lg"}`}>{mine}</blockquote>
        </figure>
      )}

      {error && (
        <p role="alert" className="text-sm font-semibold text-danger">
          {error}
        </p>
      )}

      {partner.state === "shown" ? (
        <figure data-answer="partner" className="paper grid gap-1 rounded-control border-[3px] border-outline px-3 py-2.5">
          <figcaption className="flex items-center gap-1.5 text-sm font-bold">
            <span aria-hidden className="size-2.5 rounded-full border-2 border-outline bg-partner" />
            <span className="truncate">{partnerName}</span>
          </figcaption>
          <Translatable text={partner.value} language={language}>
            {(shown) => <blockquote className={`font-medium [overflow-wrap:anywhere] ${compact ? "" : "text-lg"}`}>{shown}</blockquote>}
          </Translatable>
        </figure>
      ) : partner.state === "hidden" ? (
        // Theirs waits under a sheet until you've answered, like the hidden reviews.
        <p data-answer="hidden" className="paper flex items-center gap-3 rounded-control border-[3px] border-dashed border-outline bg-partner-soft px-3 py-2 text-sm font-semibold">
          <Couch who="partner" size={34} />
          <span>{t.partnerHidden(partnerName)}</span>
        </p>
      ) : (
        <p className="text-sm text-muted">{mine === null ? t.partnerWaiting(partnerName) : t.partnerSees(partnerName)}</p>
      )}
    </div>
  );
}
