import type { ReactNode } from "react";
import { ExternalIcon } from "@/components/icons";
import { getI18n } from "@/lib/i18n/server";
import { getCriticScores } from "@/lib/omdb";
import { dateLocale } from "@/lib/places";
import type { TitleRef } from "@/lib/watch";

/** The tiles' shared look: a paper sticker with a small hard shadow, so it reads on any ground. */
export const SCORE_TILE =
  "paper flex items-baseline gap-2 rounded-control border-[2.5px] border-outline px-3 py-1 shadow-[var(--lift-sm)_var(--lift-sm)_0_var(--outline)]";

/**
 * Critic scores from OMDb (Sprint 23): IMDb, Rotten Tomatoes and Metacritic, whichever it has, with OMDb's
 * credit. Nothing at all when OMDb isn't set up or has no scores for the title. Wrap it in <Suspense> with
 * ScoresSkeleton.
 */
export async function CriticScores({ titleRef }: { titleRef: TitleRef }) {
  const [{ language, t }, scores] = await Promise.all([getI18n(), getCriticScores(titleRef)]);
  if (!scores) return null;
  const text = t.people.scores;
  const locale = dateLocale(language);
  const decimal = new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const compact = new Intl.NumberFormat(locale, { notation: "compact", maximumFractionDigits: 1 });

  return (
    <div data-critic-scores className="grid justify-items-start gap-1.5">
      <ul aria-label={text.label} className="flex flex-wrap gap-2.5">
        {scores.imdb && (
          <Score
            source={text.imdb}
            value={decimal.format(scores.imdb.rating)}
            max="/10"
            label={`${text.imdb}: ${text.outOf(decimal.format(scores.imdb.rating), 10)}`}
            note={scores.imdb.votes ? text.votes(compact.format(scores.imdb.votes)) : null}
            href={`https://www.imdb.com/title/${scores.imdbId}/`}
            hrefLabel={text.openImdb}
          />
        )}
        {scores.rottenTomatoes !== undefined && (
          <Score source={text.rottenTomatoes} value={`${scores.rottenTomatoes}%`} label={`${text.rottenTomatoes}: ${scores.rottenTomatoes}%`} />
        )}
        {scores.metacritic !== undefined && (
          <Score
            source={text.metacritic}
            value={String(scores.metacritic)}
            max="/100"
            label={`${text.metacritic}: ${text.outOf(String(scores.metacritic), 100)}`}
          />
        )}
      </ul>
      <a href="https://www.omdbapi.com/" target="_blank" rel="noopener noreferrer" className="tap-area text-sm text-muted underline underline-offset-4">
        {text.credit}
      </a>
    </div>
  );
}

/** One score: where it's from, the number in display lettering, and its scale. A link for IMDb. */
function Score(props: {
  source: string;
  value: string;
  max?: string;
  /** Read out in full instead of the pieces. */
  label: string;
  note?: string | null;
  href?: string;
  hrefLabel?: string;
}) {
  const inner: ReactNode = (
    <>
      <span aria-hidden className="text-[13px] font-bold">
        {props.source}
      </span>
      <span aria-hidden className="display-ink text-xl leading-none">
        {props.value}
        {props.max && <span className="text-sm">{props.max}</span>}
      </span>
      {props.note && (
        <span aria-hidden className="text-[13px] font-semibold text-muted">
          {props.note}
        </span>
      )}
      <span className="sr-only">{props.label}</span>
    </>
  );
  return (
    <li className="relative">
      {props.href ? (
        <a
          href={props.href}
          target="_blank"
          rel="noopener noreferrer"
          title={props.hrefLabel}
          className={`${SCORE_TILE} transition duration-150 ease-(--ease-spring) hover:-translate-x-0.5 hover:-translate-y-0.5`}
        >
          {inner}
          <ExternalIcon className="size-3.5 self-center" />
        </a>
      ) : (
        <span className={SCORE_TILE}>{inner}</span>
      )}
    </li>
  );
}
