"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { StarPicker } from "@/app/title/[type]/[id]/list-panel";
import { NameTag } from "@/components/name-tag";
import { CheckIcon } from "@/components/icons";
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
  const suggested = partnerMovedOn ? current : nextEpisode(current, title.season_episodes);
  const myRating = item?.ratings[me.id] ?? null;
  const partnerRating = partner ? item?.ratings[partner.id] : undefined;

  const [watched, setWatched] = useState(true);
  const [season, setSeason] = useState(String(suggested.season));
  const [episode, setEpisode] = useState(String(suggested.episode));
  // What the episode fields were filled with. If your partner saves theirs meanwhile, the suggestion moves
  // on: follow it, unless you've already typed your own. The rest of your draft stays as it is.
  const [filledWith, setFilledWith] = useState(suggested);
  if (filledWith.season !== suggested.season || filledWith.episode !== suggested.episode) {
    setFilledWith(suggested);
    if (season === String(filledWith.season) && episode === String(filledWith.episode)) {
      setSeason(String(suggested.season));
      setEpisode(String(suggested.episode));
    }
  }
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
    <li className="card grid gap-5" aria-busy={pending}>
      <div className="flex items-start gap-4">
        <Link href={titleHref(title)} className="shrink-0 transition duration-150 ease-(--ease-spring) hover:-translate-y-0.5 hover:rotate-0">
          <Poster
            path={title.poster_path}
            title={title.title}
            size="sm"
            language={language}
            className="-rotate-3 shadow-[var(--lift-sm)_var(--lift-sm)_0_var(--outline)]"
          />
        </Link>
        <div className="grid min-w-0 content-start gap-1.5">
          <h2 className="display-ink text-2xl [overflow-wrap:anywhere]">
            <Link href={titleHref(title)} className="decoration-[3px] underline-offset-4 hover:underline">
              {text.heading(title.title)}
            </Link>
          </h2>
          <p className="text-sm font-semibold text-muted">
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
            <p className="flex items-center gap-2 font-semibold">
              <span aria-hidden className="grid size-6 shrink-0 place-items-center rounded-full border-2 border-outline bg-accent text-on-accent">
                <CheckIcon className="size-3.5" />
              </span>
              {item.watched_on ? text.alreadyWatched(formatDate(item.watched_on, language)) : text.alreadyWatchedNoDate}
            </p>
          ) : (
            // A chip that turns grape when ticked.
            <label className="chip cursor-pointer justify-self-start py-1.5 pr-4 text-base has-focus-visible:outline-3 has-focus-visible:outline-offset-2 has-focus-visible:outline-(--focus)">
              <input
                type="checkbox"
                checked={watched}
                onChange={(e) => setWatched(e.target.checked)}
                disabled={pending}
                className="peer sr-only"
              />
              <span
                aria-hidden
                className="grid size-5 place-items-center rounded-full border-2 border-outline bg-surface text-transparent peer-checked:bg-pop peer-checked:text-ink"
              >
                <CheckIcon className="size-3.5" />
              </span>
              {text.markWatched}
            </label>
          )
        ) : (
          <fieldset className="grid gap-2">
            <legend className="mb-1.5 font-bold">{text.watchedUpTo}</legend>
            <div className="flex flex-wrap items-end gap-3">
              <label className="grid gap-1">
                <span className="text-sm font-semibold">{t.title.panel.season}</span>
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
                <span className="text-sm font-semibold">{t.title.panel.episode}</span>
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
              <p className="flex items-center gap-2 text-sm font-semibold">
                <span aria-hidden className="size-3 shrink-0 rounded-full border-2 border-outline bg-partner" />
                {text.partnerMovedOn(partner.name, t.common.progress(current.season, current.episode))}
              </p>
            )}
          </fieldset>
        )}

        <div className="grid gap-1.5">
          <span className="font-bold">
            {text.yourRating} <span className="text-sm font-semibold text-muted">({text.optional})</span>
          </span>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <StarPicker rating={rating} disabled={pending} onRate={setRating} t={t} />
            {partner && partnerRating && (
              <span className="flex flex-wrap items-center gap-2">
                <NameTag name={partner.name} who="partner" />
                <span className="text-2xl leading-none">
                  <Stars rating={partnerRating} who={partner.name} language={language} />
                </span>
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
          <PartnerReviewView name={partner.name} review={reviews.partner} language={language} t={t} />
        )}

        {!item && <p className="text-sm text-muted">{text.notOnList}</p>}
        {error && (
          <p role="alert" className="text-sm font-semibold text-danger">
            {error}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-3">
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
