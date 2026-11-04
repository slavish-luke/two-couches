"use client";

import { useState, useTransition } from "react";
import { Couch } from "@/components/couch";
import { getMessages, type Messages } from "@/lib/i18n";
import { MAX_REVIEW_LENGTH, type PartnerReview, type Reviews } from "@/lib/review-rules";
import { saveReview } from "./actions";

/** Your review box: a textarea with a character count. Controlled, so the wrap-up card can save it with the rest. */
export function ReviewField(props: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  /** Whether there's a saved review that an empty box would remove. */
  saved: boolean;
  partner: { name: string; review: PartnerReview } | null;
  t: Messages;
}) {
  const t = props.t.reviews.review;
  return (
    <div className="grid gap-1.5">
      <label className="grid gap-1.5">
        <span className="flex items-baseline justify-between gap-2">
          <span className="font-bold">{t.yours}</span>
          <span className="text-xs font-semibold text-muted" aria-hidden>
            {t.count(props.value.length, MAX_REVIEW_LENGTH)}
          </span>
        </span>
        <textarea
          value={props.value}
          onChange={(e) => props.onChange(e.target.value)}
          maxLength={MAX_REVIEW_LENGTH}
          rows={3}
          disabled={props.disabled}
          placeholder={t.placeholder}
          className="field"
        />
      </label>
      {props.saved && !props.value.trim() ? (
        <span className="text-sm font-semibold text-danger">{t.willDelete}</span>
      ) : (
        props.partner &&
        props.partner.review.state === "none" && (
          <span className="text-sm text-muted">{t.hint(props.partner.name)}</span>
        )
      )}
    </div>
  );
}

/**
 * What you may see of your partner's review: that they've written one, or the review itself. Nothing while
 * they haven't (your own box's hint says so).
 */
export function PartnerReviewView({ name, review, t }: { name: string; review: PartnerReview; t: Messages }) {
  const text = t.reviews.review;
  if (review.state === "none") return null;
  if (review.state === "hidden") {
    // A little nudge from the partner's couch: theirs is waiting under a sheet until you write yours.
    return (
      <p className="paper flex items-center gap-3 rounded-control border-[3px] border-dashed border-outline bg-partner-soft px-3 py-2.5 font-semibold">
        <Couch who="partner" size={40} />
        <span>{text.partnerHidden(name)}</span>
      </p>
    );
  }
  return (
    <figure className="paper grid gap-2 rounded-control border-[3px] border-outline p-3.5">
      <figcaption>
        <span className="inline-flex max-w-full items-center rounded-full border-[2.5px] border-outline bg-partner px-2.5 text-sm font-bold">
          <span className="truncate">{text.partnerShown(name)}</span>
        </span>
      </figcaption>
      <blockquote className="whitespace-pre-line font-medium">{review.body}</blockquote>
    </figure>
  );
}

/** "Reviews" on a title page's "On our list" panel: write or change yours, and see your partner's once you have. */
export function ReviewSection(props: {
  itemId: string;
  reviews: Reviews;
  partnerName: string | null;
  language: string;
}) {
  const t = getMessages(props.language);
  const { mine, partner } = props.reviews;
  // null until edited, so a review saved on the other screen shows up here.
  const [draft, setDraft] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  const value = draft ?? mine ?? "";
  const dirty = draft !== null && draft.trim() !== (mine ?? "");

  return (
    <form
      className="grid gap-3"
      aria-busy={pending}
      onSubmit={(e) => {
        e.preventDefault();
        setError(undefined);
        startTransition(async () => {
          const result = await saveReview(props.itemId, value);
          if (result.error) setError(result.error);
          else setDraft(null);
        });
      }}
    >
      <h3 className="text-lg font-bold">{t.reviews.review.heading}</h3>
      <ReviewField
        value={value}
        onChange={setDraft}
        saved={mine !== null}
        partner={props.partnerName ? { name: props.partnerName, review: partner } : null}
        t={t}
      />
      {dirty && (
        <div className="flex flex-wrap gap-2.5">
          <button className="btn" disabled={pending}>
            {t.reviews.review.save}
          </button>
          <button type="button" className="btn-quiet" onClick={() => setDraft(null)}>
            {t.reviews.review.cancel}
          </button>
        </div>
      )}
      {error && (
        <p role="alert" className="text-sm font-semibold text-danger">
          {error}
        </p>
      )}
      {props.partnerName && <PartnerReviewView name={props.partnerName} review={partner} t={t} />}
    </form>
  );
}
