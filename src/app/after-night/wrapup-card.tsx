"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { StarPicker } from "@/app/title/[type]/[id]/list-panel";
import { Poster } from "@/components/poster";
import { Stars } from "@/components/stars";
import { getMessages } from "@/lib/i18n";
import { formatDate } from "@/lib/list-rules";
import { formatDay } from "@/lib/night-rules";
import type { Wrapup } from "@/lib/reviews";
import { nextEpisode } from "@/lib/review-rules";
import { titleHref } from "@/lib/watch";
import { saveWrapup, skipWrapup, type ReviewResult, type WrapupInput } from "./actions";
import { PartnerReviewView, ReviewField } from "./review-box";

type Person = { id: string; name: string };

/**
 * "How was {title}?" after a watch night: mark the film watched (or move the series on), rate it and review
 * it, or put it off with "Not now". Either way the card goes away for you.
 */
export function WrapupCard(props: {
  wrapup: Wrapup;
  me: Person;
  partner: Person | null;
  language: string;
  timeZone: string;
}) {
  const { wrapup, me, partner, language } = props;
  const { night, title, item, reviews } = wrapup;
  const t = getMessages(language);
  const text = t.reviews.wrapup;
  const isFilm = title.media_type === "movie";

  const current = item?.season && item.episode ? { season: item.season, episode: item.episode } : null;
  // If your partner has already saved theirs, they've moved the series on for both of you.
  const partnerMovedOn = wrapup.partnerOutcome === "saved" && current !== null;
  const suggested = partnerMovedOn ? current : nextEpisode(current);
  const myRating = item?.ratings[me.id] ?? null;
  const partnerRating = partner ? item?.ratings[partner.id] : undefined;

  const [watched, setWatched] = useState(true);
  const [season, setSeason] = useState(String(suggested.season));
  const [episode, setEpisode] = useState(String(suggested.episode));
  const [rating, setRating] = useState<number | null>(myRating);
  const [review, setReview] = useState(reviews.mine ?? "");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();

  function run(action: () => Promise<ReviewResult>) {
    setError(undefined);
    startTransition(async () => {
      const result = await action();
      if (result.error) setError(result.error);
    });
  }

  function save() {
    const input: WrapupInput = { rating, review };
    if (isFilm) input.watched = watched;
    else if (Number(season) > 0 && Number(episode) > 0)
      input.progress = { season: Number(season), episode: Number(episode) };
    run(() => saveWrapup(night.id, input));
  }

  return (
    <li className="card grid gap-4 p-4" aria-busy={pending}>
      <div className="flex items-start gap-4">
        <Poster path={title.poster_path} title={title.title} size="sm" language={language} />
        <div className="grid min-w-0 content-start gap-1">
          <h2 className="font-display text-xl font-semibold leading-snug">
            <Link href={titleHref(title)} className="hover:underline">
              {text.heading(title.title)}
            </Link>
          </h2>
          <p className="text-sm text-muted">
            {text.when(formatDay(new Date(night.starts_at), props.timeZone, language))}
          </p>
        </div>
      </div>

      <form
        className="grid gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        {isFilm ? (
          item?.status === "watched" ? (
            <p className="text-sm font-semibold">
              <span aria-hidden className="text-both">
                ✓{" "}
              </span>
              {item.watched_on ? text.alreadyWatched(formatDate(item.watched_on, language)) : text.alreadyWatchedNoDate}
            </p>
          ) : (
            <label className="flex items-center gap-2 font-semibold">
              <input
                type="checkbox"
                checked={watched}
                onChange={(e) => setWatched(e.target.checked)}
                disabled={pending}
                className="size-4 accent-(--both)"
              />
              {text.markWatched}
            </label>
          )
        ) : (
          <fieldset className="grid gap-2">
            <legend className="mb-1 text-sm font-semibold">{text.watchedUpTo}</legend>
            <div className="flex flex-wrap items-end gap-3">
              <label className="grid gap-1">
                <span className="text-xs text-muted">{t.title.panel.season}</span>
                <input
                  type="number"
                  min={1}
                  value={season}
                  onChange={(e) => setSeason(e.target.value)}
                  disabled={pending}
                  className="field w-24"
                />
              </label>
              <label className="grid gap-1">
                <span className="text-xs text-muted">{t.title.panel.episode}</span>
                <input
                  type="number"
                  min={1}
                  value={episode}
                  onChange={(e) => setEpisode(e.target.value)}
                  disabled={pending}
                  className="field w-24"
                />
              </label>
            </div>
            {partnerMovedOn && partner && current && (
              <p className="text-xs text-muted">
                {text.partnerMovedOn(partner.name, t.common.progress(current.season, current.episode))}
              </p>
            )}
          </fieldset>
        )}

        <div className="grid gap-1">
          <span className="text-sm font-semibold">
            {text.yourRating} <span className="font-normal text-muted">({text.optional})</span>
          </span>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <StarPicker rating={rating} disabled={pending} onRate={setRating} t={t} />
            {partner && partnerRating && (
              <span className="text-sm">
                {partner.name}: <Stars rating={partnerRating} who={partner.name} language={language} />
              </span>
            )}
          </div>
        </div>

        <ReviewField
          value={review}
          onChange={setReview}
          disabled={pending}
          saved={reviews.mine !== null}
          partner={partner && { name: partner.name, review: reviews.partner }}
          t={t}
        />
        {partner && reviews.partner.state !== "none" && (
          <PartnerReviewView name={partner.name} review={reviews.partner} t={t} />
        )}

        {!item && <p className="text-xs text-muted">{text.notOnList}</p>}
        {error && <p className="text-sm text-danger">{error}</p>}

        <div className="flex flex-wrap gap-2">
          <button className="btn" disabled={pending}>
            {pending ? text.saving : text.save}
          </button>
          <button
            type="button"
            className="btn-quiet"
            disabled={pending}
            onClick={() => run(() => skipWrapup(night.id))}
          >
            {text.notNow}
          </button>
        </div>
      </form>
    </li>
  );
}
