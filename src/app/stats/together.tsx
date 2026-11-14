import Link from "next/link";
import type { CSSProperties } from "react";
import { Celebrate, type MilestoneItem } from "@/components/celebrate";
import { ArrowIcon } from "@/components/icons";
import { NameTag } from "@/components/name-tag";
import { RollText } from "@/components/roll-text";
import { isFilmMilestone, isNewBestStreak, milestoneKey } from "@/lib/moments";
import type { Messages } from "@/lib/i18n";
import { formatDate } from "@/lib/list-rules";
import type { StatsEntry } from "@/lib/stats-rules";
import { TASTE_MIN_SHARED, type Sticker } from "@/lib/taste-rules";
import { StickerArt } from "./sticker";

/*
 * Stats' all-time part (Sprint 17): taste match, weeks in a row, milestones, rating guesses and stickers.
 * Pure rendering: the page works everything out with taste-rules.ts and passes it in.
 */

export type TogetherData = {
  taste: { shared: number; needed: number; percent: number | null };
  streak: { current: number; best: number };
  films: { count: number; latest: StatsEntry | null };
  titles: number;
  firstNight: string | null;
  anniversary: { years: number; isToday: boolean; next: string; daysToNext: number } | null;
  guesses: { me: GuessTally; partner: GuessTally };
  stickers: Sticker[];
};

type GuessTally = { made: number; within: number; exact: number };

export function Together({
  data,
  partnerName,
  language,
  t,
}: {
  data: TogetherData;
  partnerName: string;
  language: string;
  t: Messages;
}) {
  const s = t.stats;
  return (
    <section aria-labelledby="together" className="grid gap-5">
      <Celebrate items={milestoneItems(data)} />
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h2 id="together" className="display text-[2rem]">
          {s.together.heading}
        </h2>
        <span className="strand">{s.together.allTime}</span>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <TasteCard taste={data.taste} language={language} t={t} />
        <StreakCard streak={data.streak} t={t} />
        <MilestonesCard data={data} language={language} t={t} />
        <GuessesCard guesses={data.guesses} partnerName={partnerName} t={t} />
      </div>
      <StickerShelf stickers={data.stickers} t={t} />
    </section>
  );
}

/**
 * The milestones on this part that get confetti the first time this device sees them (Sprint 28): today's
 * anniversary, a new best streak, a round film number and every sticker earned from now on.
 */
function milestoneItems(data: TogetherData): MilestoneItem[] {
  const items: MilestoneItem[] = [];
  if (data.anniversary?.isToday) {
    items.push({ id: milestoneKey.anniversary(data.anniversary.years), target: '[data-ms="anniversary"]' });
  }
  if (isNewBestStreak(data.streak.current, data.streak.best)) {
    items.push({ id: milestoneKey.streak(data.streak.current), target: '[data-ms="streak"] svg' });
  }
  if (data.films.latest && isFilmMilestone(data.films.count)) {
    items.push({ id: milestoneKey.film(data.films.count), target: '[data-ms="film"]' });
  }
  for (const sticker of data.stickers) {
    if (sticker.earned) {
      items.push({ id: milestoneKey.sticker(sticker.id), target: `[data-ms="sticker:${sticker.id}"] .sticker-art`, seed: true });
    }
  }
  return items;
}

function TasteCard({ taste, language, t }: { taste: TogetherData["taste"]; language: string; t: Messages }) {
  const s = t.stats.taste;
  const shown = taste.percent;
  return (
    <section data-taste data-roll-group className="card grid content-start gap-3">
      <h3 className="display-ink text-2xl">{s.heading}</h3>
      {shown === null ? (
        <>
          {/* How close you are to seeing it: a bar of the shared ratings so far. */}
          <div
            role="img"
            aria-label={t.stats.stickers.progress(taste.shared, TASTE_MIN_SHARED)}
            className="h-6 overflow-hidden rounded-full border-[3px] border-outline bg-surface"
          >
            <span
              data-bar-x
              style={{ width: `${(taste.shared / TASTE_MIN_SHARED) * 100}%` }}
              className="block h-full border-r-[3px] border-outline bg-accent-soft"
            />
          </div>
          <p className="font-medium text-muted">{s.notYet(taste.needed)}</p>
        </>
      ) : (
        <>
          <p className="display-ink text-[clamp(3rem,7vw,4rem)] leading-none">
            <span className="sr-only">{new Intl.NumberFormat(language, { style: "percent" }).format(shown / 100)}</span>
            {/* Counts up beside the meter (Sprint 28); screen readers get the copy above. */}
            <span aria-hidden data-count data-to={shown} data-format="percent" className="inline-block">
              {new Intl.NumberFormat(language, { style: "percent" }).format(shown / 100)}
            </span>
          </p>
          <div
            role="img"
            aria-label={s.label(shown)}
            className="h-6 overflow-hidden rounded-full border-[3px] border-outline bg-surface shadow-[var(--lift-sm)_var(--lift-sm)_0_var(--outline)]"
          >
            <span
              style={{ "--w": `${shown}%` } as CSSProperties}
              data-meter
              className="taste-fill block h-full w-(--w) border-r-[3px] border-outline bg-stamp"
            />
          </div>
          <p className="text-sm font-medium text-muted">{s.method(taste.shared)}</p>
        </>
      )}
      {taste.shared > 0 && (
        <Link
          href="/stats/disagree"
          className="tap-area group inline-flex w-fit items-center gap-1 font-bold underline underline-offset-4"
        >
          {t.stats.disagreeLink}
          <ArrowIcon className="size-4 transition-transform duration-200 ease-(--ease-spring) group-hover:translate-x-1" />
        </Link>
      )}
    </section>
  );
}

function StreakCard({ streak, t }: { streak: TogetherData["streak"]; t: Messages }) {
  const s = t.stats.streak;
  return (
    <section data-roll-group className="card grid content-start gap-3">
      <h3 className="display-ink text-2xl">{s.heading}</h3>
      {streak.current > 0 ? (
        <p data-ms="streak" className="flex items-center gap-3">
          <StickerArt id="streak" className="size-14 shrink-0 -rotate-6" />
          <span className="display-ink text-[clamp(2.2rem,5vw,2.8rem)] leading-none">
            <RollText text={s.current(streak.current)} value={String(streak.current)} />
          </span>
        </p>
      ) : (
        <p className="font-medium">{s.none}</p>
      )}
      {streak.best > 0 && <p className="font-bold">{s.best(streak.best)}</p>}
      <p className="text-sm text-muted">{s.rule}</p>
    </section>
  );
}

function MilestonesCard({ data, language, t }: { data: TogetherData; language: string; t: Messages }) {
  const s = t.stats.milestones;
  const items: { line: string; ms?: string }[] = [];
  if (data.films.latest) items.push({ line: s.film(data.films.count, data.films.latest.title), ms: "film" });
  if (data.titles > 0) items.push({ line: s.titles(data.titles) });
  if (data.firstNight) items.push({ line: s.firstNight(formatDate(data.firstNight, language)) });
  const a = data.anniversary;
  return (
    <section className="card grid content-start gap-3">
      <h3 className="display-ink text-2xl">{s.heading}</h3>
      {a?.isToday && (
        <p data-ms="anniversary" className="w-fit -rotate-1 rounded-control border-[3px] border-outline bg-pop px-3 py-1.5 font-bold shadow-[var(--lift-sm)_var(--lift-sm)_0_var(--outline)]">
          {s.anniversaryToday(a.years)}
        </p>
      )}
      {items.length > 0 ? (
        <ul className="grid gap-2">
          {items.map(({ line, ms }) => (
            <li key={line} data-ms={ms} className="flex items-baseline gap-2 font-semibold">
              <span aria-hidden className="size-2.5 shrink-0 translate-y-[-0.1em] rounded-full border-2 border-outline bg-accent" />
              <span className="min-w-0 [overflow-wrap:anywhere]">{line}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="font-medium text-muted">{s.noNights}</p>
      )}
      {a && !a.isToday && (
        <p className="text-sm text-muted">
          {a.years > 0 && `${s.years(a.years)} · `}
          {s.nextAnniversary(a.daysToNext, formatDate(a.next, language))}
        </p>
      )}
    </section>
  );
}

function GuessesCard({ guesses, partnerName, t }: { guesses: TogetherData["guesses"]; partnerName: string; t: Messages }) {
  const s = t.stats.guesses;
  const line = (tally: GuessTally) =>
    tally.made === 0 ? (
      <span className="text-muted">{s.none}</span>
    ) : (
      <span className="font-semibold">
        {s.within(tally.made, tally.within)}
        {tally.exact > 0 && ` · ${s.exact(tally.exact)}`}
      </span>
    );
  return (
    <section className="card grid content-start gap-3">
      <h3 className="display-ink text-2xl">{s.heading}</h3>
      <dl className="grid gap-2">
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <dt>
            <NameTag name={t.common.you} who="me" />
          </dt>
          <dd>{line(guesses.me)}</dd>
        </div>
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <dt>
            <NameTag name={partnerName} who="partner" />
          </dt>
          <dd>{line(guesses.partner)}</dd>
        </div>
      </dl>
      {guesses.me.made === 0 && <p className="text-sm text-muted">{s.how}</p>}
    </section>
  );
}

function StickerShelf({ stickers, t }: { stickers: Sticker[]; t: Messages }) {
  const s = t.stats.stickers;
  return (
    <section className="card grid gap-4">
      <div className="grid gap-1">
        <h3 className="display-ink text-2xl">{s.heading}</h3>
        <p className="text-muted">{s.intro}</p>
      </div>
      <ul className="grid grid-cols-[repeat(auto-fill,minmax(7.5rem,1fr))] gap-x-3 gap-y-5">
        {stickers.map((sticker, i) => (
          <li
            key={sticker.id}
            data-earned={sticker.earned}
            data-ms={`sticker:${sticker.id}`}
            style={{ "--i": i, "--r": `${i % 2 ? 5 : -5}deg` } as CSSProperties}
            className="sticker-item grid content-start justify-items-center gap-1.5 text-center"
          >
            <StickerArt id={sticker.id} className="sticker-art size-22" />
            <span className="font-bold leading-tight">{s.names[sticker.id]}</span>
            <span className="text-sm leading-snug text-muted">
              {sticker.earned ? (
                <>
                  <span className="sr-only">{s.earned}: </span>
                  {s.hints[sticker.id]}
                </>
              ) : sticker.progress ? (
                `${s.hints[sticker.id]} · ${s.progress(sticker.progress.have, sticker.progress.need)}`
              ) : (
                s.hints[sticker.id]
              )}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
