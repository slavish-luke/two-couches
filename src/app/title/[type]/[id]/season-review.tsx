"use client";

import { useState, useTransition } from "react";
import { saveSeasonReview } from "@/app/list/shelf-actions";
import { NameTag } from "@/components/name-tag";
import { Translatable } from "@/components/translate";
import { getMessages } from "@/lib/i18n";
import { MAX_SEASON_REVIEW, type PartnerSeasonReview } from "@/lib/shelf-rules";

/**
 * Sprint 21: your short review of one season, beside its stars, and your partner's once you've both written
 * one. Like the title's own hidden review: theirs stays under a sheet until yours exists, and emptying yours
 * deletes it (which hides theirs again).
 */
export function SeasonReview(props: {
  itemId: string;
  season: number;
  mine: string | null;
  partner: { name: string; review: PartnerSeasonReview } | null;
  language: string;
}) {
  const { mine, partner, language } = props;
  const t = getMessages(language);
  const s = t.shelf.seasonReview;
  const r = t.reviews.review;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(mine ?? "");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();

  function open() {
    setDraft(mine ?? "");
    setError(undefined);
    setEditing(true);
  }

  return (
    <div data-season-review className="grid w-full gap-2">
      {editing ? (
        <form
          className="grid gap-1.5"
          aria-busy={pending}
          onSubmit={(e) => {
            e.preventDefault();
            setError(undefined);
            startTransition(async () => {
              const result = await saveSeasonReview(props.itemId, props.season, draft);
              if (result.error) setError(result.error);
              else setEditing(false);
            });
          }}
        >
          <label className="grid gap-1">
            <span className="flex items-baseline justify-between gap-2">
              <span className="sr-only">{s.label(props.season)}</span>
              <span aria-hidden className="text-sm font-bold">
                {s.edit}
              </span>
              <span className="text-xs font-semibold text-muted" aria-hidden>
                {s.count(draft.length, MAX_SEASON_REVIEW)}
              </span>
            </span>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              maxLength={MAX_SEASON_REVIEW}
              rows={2}
              autoFocus
              placeholder={s.placeholder}
              className="field text-[15px]"
            />
          </label>
          {mine !== null && !draft.trim() ? (
            <span className="text-sm font-semibold text-danger">{s.willDelete}</span>
          ) : (
            partner?.review.state === "none" && <span className="text-sm text-muted">{r.hint(partner.name)}</span>
          )}
          <div className="flex flex-wrap gap-2">
            <button className="btn px-3 py-1 text-sm" disabled={pending}>
              {s.save}
            </button>
            <button type="button" className="btn-quiet px-3 py-1 text-sm" onClick={() => setEditing(false)}>
              {s.cancel}
            </button>
          </div>
          {error && (
            <p role="alert" className="text-sm font-semibold text-danger">
              {error}
            </p>
          )}
        </form>
      ) : mine ? (
        <div className="grid gap-0.5">
          <p className="flex flex-wrap items-baseline gap-x-2">
            <span className="text-sm font-bold">{s.edit}</span>
            <button type="button" onClick={open} className="tap-area text-sm font-bold underline underline-offset-4">
              {t.title.panel.edit}
            </button>
          </p>
          <p className="whitespace-pre-line text-[15px] font-medium [overflow-wrap:anywhere]">{mine}</p>
        </div>
      ) : (
        <button type="button" onClick={open} className="tap-area justify-self-start text-sm font-bold underline underline-offset-4">
          {s.write}
          <span className="sr-only"> ({s.label(props.season)})</span>
        </button>
      )}

      {partner?.review.state === "hidden" && (
        <p className="paper flex items-center gap-2 rounded-control border-[2.5px] border-dashed border-outline bg-partner-soft px-2.5 py-1.5 text-sm font-semibold">
          {r.partnerHidden(partner.name)}
        </p>
      )}
      {partner?.review.state === "shown" && (
        <figure className="paper grid gap-1.5 rounded-control border-[2.5px] border-outline px-3 py-2">
          <figcaption>
            <NameTag name={r.partnerShown(partner.name)} who="partner" />
          </figcaption>
          <Translatable text={partner.review.body} language={language}>
            {(shown) => <blockquote className="whitespace-pre-line text-[15px] font-medium [overflow-wrap:anywhere]">{shown}</blockquote>}
          </Translatable>
        </figure>
      )}
    </div>
  );
}
