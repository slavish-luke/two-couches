"use client";

import { useState, useTransition } from "react";
import type { ListResult } from "@/app/list/actions";
import { logRewatch, rateRewatch, rateSeason, redateRewatch, removeRewatch } from "@/app/list/diary-actions";
import { PlusIcon, RepeatIcon, StarIcon } from "@/components/icons";
import { NameTag } from "@/components/name-tag";
import { Stars } from "@/components/stars";
import { seasonsToRate, watchHistory, FIRST_WATCH_DATE, type Rewatch, type SeasonRatings } from "@/lib/diary-rules";
import { getMessages, type Messages } from "@/lib/i18n";
import type { ListItem } from "@/lib/list";
import { formatDate, localDate } from "@/lib/list-rules";

// Sprint 18's parts of the "On our list" panel: the watch history (rewatches) and ratings per season.

type Person = { id: string; name: string };

function useAction() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  function run(action: () => Promise<ListResult>, onDone?: () => void) {
    setError(undefined);
    startTransition(async () => {
      const result = await action();
      if (result.error) setError(result.error);
      else onDone?.();
    });
  }
  return { pending, error, run };
}

function ErrorLine({ error }: { error?: string }) {
  return error ? (
    <p role="alert" className="text-sm font-semibold text-danger">
      {error}
    </p>
  ) : null;
}

/**
 * Your own 1-5 rating as a row of small stars (choosing it again clears it), for a rewatch or a season.
 * `label` names what's rated, for screen readers.
 */
function MiniStars({ rating, label, disabled, onRate, t }: { rating: number | null; label: string; disabled: boolean; onRate: (rating: number | null) => void; t: Messages }) {
  const [hover, setHover] = useState<number | null>(null);
  const shown = hover ?? rating ?? 0;
  return (
    <span role="radiogroup" aria-label={label} className="flex" onMouseLeave={() => setHover(null)}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={rating === n}
          aria-label={t.title.panel.starCount(n)}
          title={rating === n ? t.title.panel.clearRating : undefined}
          disabled={disabled}
          onMouseEnter={() => setHover(n)}
          onFocus={() => setHover(n)}
          onBlur={() => setHover(null)}
          onClick={() => onRate(rating === n ? null : n)}
          className="grid size-8 place-items-center rounded-full transition duration-150 ease-(--ease-spring) hover:-translate-y-0.5 hover:-rotate-6 hover:scale-110 active:scale-90 disabled:opacity-60"
        >
          <StarIcon filled={n <= shown} className="size-6" />
        </button>
      ))}
    </span>
  );
}

/** Your partner's rating of something, read-only, or a quiet "no rating". */
function TheirStars({ partner, rating, language, t }: { partner: Person; rating: number | undefined; language: string; t: Messages }) {
  return (
    <span className="flex flex-wrap items-center gap-2">
      <NameTag name={partner.name} who="partner" />
      {rating ? (
        <span className="text-xl leading-none">
          <Stars rating={rating} who={partner.name} language={language} />
        </span>
      ) : (
        <span className="text-sm font-semibold text-muted">{t.diary.notRated}</span>
      )}
    </span>
  );
}

/**
 * "Watched 3 times: 4 Jan 2025, 12 Mar 2026, 1 Nov 2026", each rewatch with its own date and both ratings
 * of that watch, and "Watched it again" to log another.
 */
export function WatchHistory(props: {
  item: ListItem;
  rewatches: Rewatch[];
  me: Person;
  partner: Person | null;
  language: string;
  timeZone: string;
}) {
  const { item, me, partner, language } = props;
  const t = getMessages(language);
  const d = t.diary.history;
  const { pending, error, run } = useAction();
  const [logging, setLogging] = useState(false);
  const today = localDate(props.timeZone);
  const history = watchHistory(item.watched_on, props.rewatches);
  const dates = new Intl.ListFormat(language, { type: "unit" }).format(history.map((w) => formatDate(w.date, language)));

  return (
    <div data-watch-history className="grid gap-3" aria-busy={pending}>
      <h3 className="text-lg font-bold">{d.heading}</h3>
      {history.length > 1 && (
        <p className="font-medium">
          <span className="font-bold">{d.times(history.length)}</span> {dates}
        </p>
      )}
      {props.rewatches.length > 0 && (
        <ol className="grid gap-2.5">
          {history.map((watch, i) =>
            watch.rewatch ? (
              <RewatchRow
                key={watch.rewatch.id}
                rewatch={watch.rewatch}
                nth={i + 1}
                me={me}
                partner={partner}
                today={today}
                language={language}
                run={run}
                pending={pending}
              />
            ) : null,
          )}
        </ol>
      )}
      {logging ? (
        <LogRewatch
          today={today}
          pending={pending}
          onCancel={() => setLogging(false)}
          onLog={(date, rating) => run(() => logRewatch(item.id, date, rating), () => setLogging(false))}
          t={t}
        />
      ) : (
        <button type="button" className="btn-quiet w-fit text-sm" disabled={pending} onClick={() => setLogging(true)}>
          <RepeatIcon className="size-4" />
          {d.again}
        </button>
      )}
      <ErrorLine error={error} />
    </div>
  );
}

function RewatchRow(props: {
  rewatch: Rewatch;
  nth: number;
  me: Person;
  partner: Person | null;
  today: string;
  language: string;
  pending: boolean;
  run: ReturnType<typeof useAction>["run"];
}) {
  const { rewatch, me, partner, language, pending, run } = props;
  const t = getMessages(language);
  const d = t.diary.history;
  const [confirming, setConfirming] = useState(false);
  const date = formatDate(rewatch.watched_on, language);

  return (
    <li data-rewatch className="paper grid gap-2 rounded-control border-[2.5px] border-outline px-3 py-2.5">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <label className="flex flex-wrap items-center gap-2">
          <span className="font-bold">{d.nth(props.nth)}</span>
          <input
            key={rewatch.watched_on}
            type="date"
            defaultValue={rewatch.watched_on}
            min={FIRST_WATCH_DATE}
            max={props.today}
            disabled={pending}
            aria-label={d.dateOf(props.nth)}
            onBlur={(e) => e.target.value && e.target.value !== rewatch.watched_on && run(() => redateRewatch(rewatch.id, e.target.value))}
            className="field w-auto py-1 text-[15px]"
          />
        </label>
        {confirming ? (
          <span className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-semibold">{d.removeConfirm}</span>
            <button type="button" className="btn-quiet bg-danger-soft text-sm text-danger" disabled={pending} onClick={() => run(() => removeRewatch(rewatch.id))}>
              {d.removeYes}
            </button>
            <button type="button" className="btn-quiet text-sm" onClick={() => setConfirming(false)}>
              {t.title.panel.removeNo}
            </button>
          </span>
        ) : (
          <button type="button" className="tap-area text-sm font-bold text-danger underline underline-offset-4" onClick={() => setConfirming(true)}>
            {d.remove}
          </button>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <span className="flex flex-wrap items-center gap-1.5">
          <NameTag name={t.common.you} who="me" />
          <MiniStars
            rating={rewatch.ratings[me.id] ?? null}
            label={d.yourRatingOf(date)}
            disabled={pending}
            onRate={(rating) => run(() => rateRewatch(rewatch.id, rating))}
            t={t}
          />
        </span>
        {partner && <TheirStars partner={partner} rating={rewatch.ratings[partner.id]} language={language} t={t} />}
      </div>
    </li>
  );
}

function LogRewatch(props: { today: string; pending: boolean; onCancel: () => void; onLog: (date: string, rating: number | null) => void; t: Messages }) {
  const { t } = props;
  const d = t.diary.history;
  const [rating, setRating] = useState<number | null>(null);
  return (
    <form
      data-log-rewatch
      className="paper grid gap-3 rounded-control border-[3px] border-outline p-3"
      onSubmit={(e) => {
        e.preventDefault();
        const date = String(new FormData(e.currentTarget).get("date") ?? "");
        if (date) props.onLog(date, rating);
      }}
    >
      <div className="flex flex-wrap items-end gap-x-5 gap-y-3">
        <label className="grid gap-1">
          <span className="text-sm font-bold">{d.when}</span>
          <input name="date" type="date" required defaultValue={props.today} min={FIRST_WATCH_DATE} max={props.today} className="field w-auto" />
        </label>
        <span className="grid gap-1">
          <span className="text-sm font-bold">{d.ratingThisTime}</span>
          <MiniStars rating={rating} label={d.ratingThisTime} disabled={props.pending} onRate={setRating} t={t} />
        </span>
      </div>
      <div className="flex flex-wrap gap-2.5">
        <button className="btn" disabled={props.pending}>
          <PlusIcon className="size-4" />
          {d.log}
        </button>
        <button type="button" className="btn-quiet" onClick={props.onCancel}>
          {t.title.panel.cancel}
        </button>
      </div>
    </form>
  );
}

/** Each season with your stars to give and your partner's beside them, for a series you've started. */
export function SeasonRatingsPanel(props: {
  item: ListItem;
  seasons: number | null;
  rated: SeasonRatings;
  me: Person;
  partner: Person | null;
  language: string;
}) {
  const { item, rated, me, partner, language } = props;
  const t = getMessages(language);
  const d = t.diary.seasons;
  const { pending, error, run } = useAction();
  const progress = item.season && item.episode ? { season: item.season, episode: item.episode } : null;
  const shown = seasonsToRate(item.status, progress, props.seasons, rated);
  if (shown.length === 0) return null;

  return (
    <div data-season-ratings className="grid gap-2" aria-busy={pending}>
      <h3 className="text-lg font-bold">{d.heading}</h3>
      <ul className="grid gap-1.5">
        {shown.map((season) => (
          <li key={season} className="flex flex-wrap items-center gap-x-5 gap-y-1 border-b-2 border-outline/10 pb-1.5 last:border-b-0">
            <span className="min-w-[5.5rem] font-bold">{d.season(season)}</span>
            <span className="flex flex-wrap items-center gap-1.5">
              <NameTag name={t.common.you} who="me" />
              <MiniStars
                rating={rated[season]?.[me.id] ?? null}
                label={d.yourRating(season)}
                disabled={pending}
                onRate={(rating) => run(() => rateSeason(item.id, season, rating))}
                t={t}
              />
            </span>
            {partner && <TheirStars partner={partner} rating={rated[season]?.[partner.id]} language={language} t={t} />}
          </li>
        ))}
      </ul>
      <ErrorLine error={error} />
    </div>
  );
}
