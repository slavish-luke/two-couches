"use client";

import { useState, useTransition } from "react";
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
    <div className="grid gap-1">
      <label className="grid gap-1">
        <span className="flex items-baseline justify-between gap-2 text-sm">
          <span className="font-semibold">{t.yours}</span>
          <span className="text-xs text-muted" aria-hidden>
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
        <span className="text-xs text-muted">{t.willDelete}</span>
      ) : (
        props.partner &&
        props.partner.review.state === "none" && (
          <span className="text-xs text-muted">{t.hint(props.partner.name)}</span>
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
    return (
      <p className="rounded-lg border border-dashed border-partner bg-partner-soft px-3 py-2 text-sm text-partner">
        {text.partnerHidden(name)}
      </p>
    );
  }
  return (
    <figure className="grid gap-1 border-l-2 border-partner pl-3">
      <figcaption className="text-sm font-semibold text-partner">{text.partnerShown(name)}</figcaption>
      <blockquote className="whitespace-pre-line text-sm">{review.body}</blockquote>
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
      <h3 className="text-sm font-semibold">{t.reviews.review.heading}</h3>
      <ReviewField
        value={value}
        onChange={setDraft}
        saved={mine !== null}
        partner={props.partnerName ? { name: props.partnerName, review: partner } : null}
        t={t}
      />
      {dirty && (
        <div className="flex gap-2">
          <button className="btn" disabled={pending}>
            {t.reviews.review.save}
          </button>
          <button type="button" className="btn-quiet" onClick={() => setDraft(null)}>
            {t.reviews.review.cancel}
          </button>
        </div>
      )}
      {error && <p className="text-sm text-danger">{error}</p>}
      {props.partnerName && <PartnerReviewView name={props.partnerName} review={partner} t={t} />}
    </form>
  );
}
