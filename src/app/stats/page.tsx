import { NameTag } from "@/components/name-tag";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Couches } from "@/components/couch";
import { ArrowIcon, DownloadIcon, StarIcon } from "@/components/icons";
import { ListSync } from "@/components/list-sync";
import { RollIn } from "@/components/roll-in";
import { RollText } from "@/components/roll-text";
import { Poster } from "@/components/poster";
import { Stars } from "@/components/stars";
import { getGenres } from "@/lib/browse";
import type { Messages } from "@/lib/i18n";
import { getI18n, localisedTitle } from "@/lib/i18n/server";
import { getList } from "@/lib/list";
import { localDate } from "@/lib/list-rules";
import { isCountry } from "@/lib/places";
import { getPartner, requireProfile } from "@/lib/session";
import { computeStats, statsYears, type Period, type StatsEntry } from "@/lib/stats-rules";
import { getGuesses, getNightsAt } from "@/lib/taste";
import { getRewatches } from "@/lib/diary";
import {
  anniversary,
  bothFive,
  filmsInOrder,
  firstNightDate,
  guessScore,
  stickers,
  streaks,
  tasteMatch,
  watchedCount,
} from "@/lib/taste-rules";
import { tmdbLocale } from "@/lib/tmdb";
import { titleHref } from "@/lib/watch";
import { StatsSkeleton } from "./skeleton";
import { Together, type TogetherData } from "./together";

export const generateMetadata = localisedTitle("stats");

export default function StatsPage({ searchParams }: PageProps<"/stats">) {
  return (
    <Suspense fallback={<StatsSkeleton />}>
      <Stats searchParams={searchParams} />
    </Suspense>
  );
}

async function Stats({ searchParams }: Pick<PageProps<"/stats">, "searchParams">) {
  const [profile, partner, { language, t }, params] = await Promise.all([
    requireProfile(),
    getPartner(),
    getI18n(),
    searchParams,
  ]);
  if (!isCountry(profile.country)) redirect("/settings?welcome=1");
  if (!profile.couple_id) redirect("/couple");

  const locale = tmdbLocale(profile.language, profile.home_country ?? profile.country);
  const locales = partner?.country ? [locale, tmdbLocale(partner.language, partner.home_country)] : [locale];
  const zones = { [profile.id]: profile.time_zone, ...(partner ? { [partner.id]: partner.time_zone } : {}) };
  const [entries, nightsAt, guesses, movieGenres, tvGenres, rewatches] = await Promise.all([
    getList(profile.couple_id, locales),
    getNightsAt(profile.couple_id, zones, profile.time_zone),
    getGuesses(profile.couple_id),
    getGenres("movie", locale).catch(() => []),
    getGenres("tv", locale).catch(() => []),
    getRewatches(profile.couple_id),
  ]);
  const genreNames = new Map([...movieGenres, ...tvGenres].map((g) => [g.id, g.name]));

  const now = new Date();
  const thisYear = Number(localDate(profile.time_zone, now).slice(0, 4));
  const years = statsYears(entries, thisYear, rewatches);
  const period: Period = params.year === "all" ? "all" : years.includes(Number(params.year)) ? Number(params.year) : thisYear;
  const stats = computeStats(entries, nightsAt.map((n) => n.starts_at), {
    period,
    meId: profile.id,
    partnerId: partner?.id ?? null,
    timeZone: profile.time_zone,
    now,
    rewatches,
  });
  const partnerName = partner ? partner.display_name || t.common.yourPartner : null;
  const nothingWatched = stats.films + stats.series === 0;
  const number = (value: number) => new Intl.NumberFormat(language).format(value);
  const together = partner ? togetherData(entries, nightsAt, guesses, profile.id, partner.id, profile.time_zone, now) : null;

  return (
    <div className="grid gap-9">
      <ListSync coupleId={profile.couple_id} />
      {/* Numbers roll in once per visit (Sprint 28), again for another year. */}
      <RollIn key={String(period)} />
      <div className="grid gap-4">
        <h1 className="display -rotate-1 text-[clamp(2.4rem,5vw,3.6rem)]">{t.stats.heading}</h1>
        <nav aria-label={t.stats.periodsLabel} className="flex flex-wrap gap-2">
          {[...years, "all" as const].map((year) => (
            <Link
              key={year}
              href={year === thisYear ? "/stats" : `/stats?year=${year}`}
              aria-current={period === year ? "page" : undefined}
              className="chip"
            >
              {year === "all" ? t.stats.allTime : year}
            </Link>
          ))}
        </nav>
        <p className="font-medium text-muted">{t.stats.intro(period === "all" ? null : period)}</p>
        {period !== "all" && (
          // The year as a picture to keep (drawn by ./recap/[year]).
          <a href={`/stats/recap/${period}`} download={t.stats.recap.fileName(period)} className="btn-quiet w-fit text-sm">
            <DownloadIcon className="size-4" />
            {t.stats.recap.save(period)}
          </a>
        )}
      </div>

      {/* The headline numbers: the one spotlight on this screen. */}
      <dl data-roll-group className="spotlight grid grid-cols-2 gap-4 p-5 sm:grid-cols-4 sm:p-6">
        {(
          [
            ["films", number(stats.films)],
            ["series", number(stats.series)],
            ["hours", number(Math.round(stats.minutes / 60))],
            ["nights", number(stats.nights)],
          ] as const
        ).map(([key, value]) => (
          <div
            key={key}
            className="paper grid min-w-0 content-start justify-items-center gap-1 rounded-control border-[3px] border-outline px-3 pb-3 pt-2 text-center shadow-[4px_4px_0_var(--outline)] odd:-rotate-2 even:rotate-1"
          >
            <dd className="display-ink order-2 text-[clamp(2.8rem,6vw,3.8rem)] leading-none">
              {key === "hours" && stats.minutesIncomplete && stats.minutes > 0 && (
                <span className="mb-1 block font-sans text-sm font-semibold text-muted">
                  {t.stats.atLeast}
                </span>
              )}
              <RollText text={value} />
              {(key === "films" || key === "series") && stats.rewatches[key] > 0 && (
                <span className="mt-1 block font-sans text-sm font-semibold normal-case tracking-normal text-muted">
                  {t.diary.stats.including(stats.rewatches[key])}
                </span>
              )}
            </dd>
            <dt className="order-1 text-sm font-bold leading-snug">{t.stats.tiles[key]}</dt>
          </div>
        ))}
      </dl>

      {nothingWatched ? (
        <div className="card grid justify-items-center gap-3 py-10 text-center">
          <Couches size={56} />
          <p className="display-ink text-2xl">{period === "all" ? t.stats.empty.heading : t.stats.empty.year(period)}</p>
          {period === "all" && <p className="max-w-[28rem] text-muted">{t.stats.empty.body}</p>}
          <Link href="/?view=watched" className="btn-quiet mt-1">
            {t.stats.empty.openList}
          </Link>
        </div>
      ) : (
        <>
          {stats.months && <MonthChart months={stats.months} language={language} t={t} />}
          <GenreBars genres={stats.genres.map((g) => ({ ...g, name: genreNames.get(g.id) ?? "?" }))} t={t} />
          <Ratings
            stats={stats}
            meId={profile.id}
            partner={partner && partnerName ? { id: partner.id, name: partnerName } : null}
            language={language}
            t={t}
          />
        </>
      )}

      {partner && partnerName && stats.added.me + stats.added.partner > 0 && (
        <AddedBar added={stats.added} partnerName={partnerName} t={t} />
      )}

      {together && partnerName && <Together data={together} partnerName={partnerName} language={language} t={t} />}
    </div>
  );
}

/** Everything for the all-time "Just the two of you" part, from the list, the nights and the guesses. */
function togetherData(
  entries: StatsEntry[],
  nights: Parameters<typeof streaks>[0],
  guesses: Parameters<typeof guessScore>[0],
  meId: string,
  partnerId: string,
  timeZone: string,
  now: Date,
): TogetherData {
  const streak = streaks(nights, now, timeZone);
  const films = filmsInOrder(entries);
  const first = firstNightDate(nights, now);
  const a = first ? anniversary(first, localDate(timeZone, now)) : null;
  const titles = watchedCount(entries);
  const happened = nights.filter((n) => Date.parse(n.starts_at) <= now.getTime()).length;
  return {
    taste: tasteMatch(entries, meId, partnerId),
    streak,
    films: { count: films.length, latest: films.at(-1) ?? null },
    titles,
    firstNight: first,
    anniversary: a,
    guesses: { me: guessScore(guesses, meId), partner: guessScore(guesses, partnerId) },
    stickers: stickers({
      nights: happened,
      titles,
      bestStreak: streak.best,
      bothFive: bothFive(entries, meId, partnerId),
      exactGuess: guesses.some((g) => g.guess !== null && g.guess === g.actual),
      years: a?.years ?? 0,
    }),
  };
}

/** Titles finished each month: one column per month, the busiest labelled, every one hoverable. */
function MonthChart({ months, language, t }: { months: number[]; language: string; t: Messages }) {
  const max = Math.max(...months, 1);
  const busiest = months.indexOf(Math.max(...months));
  const name = (i: number, month: "long" | "narrow") =>
    new Intl.DateTimeFormat(language, { month, timeZone: "UTC" }).format(new Date(Date.UTC(2000, i, 1)));
  return (
    <section data-roll-group className="card grid gap-4">
      <h2 className="display-ink text-2xl">{t.stats.months.heading}</h2>
      <ol className="grid h-40 grid-cols-12 items-end gap-1 border-b-[3px] border-outline sm:gap-2">
        {months.map((count, i) => (
          <li
            key={i}
            tabIndex={0}
            aria-label={t.stats.months.count(name(i, "long"), count)}
            className="group relative flex h-full flex-col items-center justify-end outline-none"
          >
            {count > 0 && i === busiest && (
              <span aria-hidden className="display-ink mb-1 text-lg tabular-nums">
                {count}
              </span>
            )}
            {count > 0 && (
              <span
                aria-hidden
                data-bar-y
                style={{ height: `calc(${(count / max) * 100}% - ${i === busiest ? "1.75rem" : "0px"})` }}
                className="-mb-[3px] min-h-3 w-full max-w-9 origin-bottom rounded-t-control border-[3px] border-outline bg-accent transition duration-200 ease-(--ease-spring) group-hover:scale-y-105 group-hover:-rotate-2 group-focus-visible:-rotate-2"
              />
            )}
            <span
              aria-hidden
              // Held inside the chart at either end, so a long month name can't push the page sideways.
              className={`${i < 3 ? "left-0" : i > 8 ? "right-0" : ""} pointer-events-none invisible absolute bottom-full z-10 mb-1 whitespace-nowrap rounded-full border-[2.5px] border-outline bg-surface px-2.5 py-0.5 text-sm font-bold text-ink shadow-[var(--lift-sm)_var(--lift-sm)_0_var(--outline)] group-hover:visible group-focus-visible:visible`}
            >
              {t.stats.months.count(name(i, "long"), count)}
            </span>
          </li>
        ))}
      </ol>
      <div aria-hidden className="-mt-2 grid grid-cols-12 gap-1 text-center text-sm font-bold text-muted sm:gap-2">
        {months.map((_, i) => (
          <span key={i}>{name(i, "narrow")}</span>
        ))}
      </div>
    </section>
  );
}

/** The most-watched genres as bars from one baseline, each count at the bar's tip. */
function GenreBars({ genres, t }: { genres: { id: number; name: string; count: number }[]; t: Messages }) {
  if (genres.length === 0) return null;
  const max = genres[0].count;
  return (
    <section data-roll-group className="card grid gap-4">
      <h2 className="display-ink text-2xl">{t.stats.genres.heading}</h2>
      <ol className="grid gap-3">
        {genres.map((genre) => (
          <li key={genre.id} className="grid grid-cols-[minmax(5.5rem,9rem)_1fr] items-center gap-3">
            <span className="truncate font-semibold">{genre.name}</span>
            <span className="flex items-center gap-2.5">
              <span
                data-bar-x
                style={{ width: `${(genre.count / max) * 100}%` }}
                className="h-7 min-w-7 max-w-[calc(100%-2.5rem)] rounded-full border-[3px] border-outline bg-accent shadow-[var(--lift-sm)_var(--lift-sm)_0_var(--outline)]"
              />
              <span className="display-ink text-xl tabular-nums">{genre.count}</span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Ratings({
  stats,
  meId,
  partner,
  language,
  t,
}: {
  stats: ReturnType<typeof computeStats>;
  meId: string;
  partner: { id: string; name: string } | null;
  language: string;
  t: Messages;
}) {
  const average = (value: number | null) =>
    value === null ? (
      <span className="text-muted">{t.stats.ratings.noRatings}</span>
    ) : (
      <span className="inline-flex items-center gap-1.5">
        <span className="display-ink text-3xl tabular-nums">
          {new Intl.NumberFormat(language, { maximumFractionDigits: 1 }).format(value)}
        </span>
        <StarIcon filled className="size-6" />
      </span>
    );
  const both = (entry: StatsEntry) =>
    partner && (
      <span className="grid gap-1">
        <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
          <NameTag name={t.common.you} who="me" />
          <Stars rating={entry.ratings[meId]} who={t.common.you} language={language} />
        </span>
        <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
          <NameTag name={partner.name} who="partner" />
          <Stars rating={entry.ratings[partner.id]} who={partner.name} language={language} />
        </span>
      </span>
    );
  const titleRow = (entry: StatsEntry) => (
    <Link
      href={titleHref(entry)}
      className="group flex h-full items-center gap-3.5 rounded-control border-[2.5px] border-outline bg-surface p-2.5 transition duration-150 ease-(--ease-spring) hover:-translate-y-0.5 hover:-rotate-1 hover:shadow-[var(--lift-sm)_var(--lift-sm)_0_var(--outline)]"
    >
      <Poster path={entry.poster_path} title={entry.title} size="sm" language={language} />
      <span className="grid min-w-0 gap-1.5">
        <span className="text-lg font-bold leading-snug group-hover:underline">{entry.title}</span>
        {both(entry)}
      </span>
    </Link>
  );

  return (
    <section className="card grid gap-6">
      <h2 className="display-ink text-2xl">{t.stats.ratings.heading}</h2>
      <div className="grid gap-2">
        <h3 className="font-bold">{t.stats.ratings.average}</h3>
        <dl className="flex flex-wrap gap-3">
          <div className="flex min-w-0 items-center gap-3 rounded-control border-[2.5px] border-outline px-3 py-2">
            <dt>
              <NameTag name={t.common.you} who="me" />
            </dt>
            <dd>{average(stats.averages.me)}</dd>
          </div>
          {partner && (
            <div className="flex min-w-0 items-center gap-3 rounded-control border-[2.5px] border-outline px-3 py-2">
              <dt>
                <NameTag name={partner.name} who="partner" />
              </dt>
              <dd>{average(stats.averages.partner)}</dd>
            </div>
          )}
        </dl>
      </div>
      {stats.favourites.length > 0 && (
        <div className="grid gap-2.5">
          <h3 className="font-bold">{t.stats.ratings.favourites}</h3>
          <ol className="grid gap-3 sm:grid-cols-2">
            {stats.favourites.map((entry) => (
              <li key={entry.id}>{titleRow(entry)}</li>
            ))}
          </ol>
        </div>
      )}
      {stats.split && (
        <div className="grid gap-2.5">
          <div>
            <h3 className="font-bold">{t.stats.ratings.split}</h3>
            <p className="text-sm text-muted">{t.stats.ratings.splitIntro}</p>
          </div>
          <div className="sm:max-w-[calc(50%-0.375rem)]">{titleRow(stats.split)}</div>
        </div>
      )}
      {partner && (stats.split || stats.favourites.length > 0) && (
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

/** One chunky bar split between the two of you, each part in that person's colour, named below it. */
function AddedBar({ added, partnerName, t }: { added: { me: number; partner: number }; partnerName: string; t: Messages }) {
  const total = added.me + added.partner;
  const parts = [
    { key: "me", name: t.common.you, count: added.me, color: "bg-me" },
    { key: "partner", name: partnerName, count: added.partner, color: "bg-partner" },
  ].filter((part) => part.count > 0);
  return (
    <section data-roll-group className="card grid gap-4">
      <div className="grid gap-1">
        <h2 className="display-ink text-2xl">{t.stats.added.heading}</h2>
        <p className="text-muted">{t.stats.added.intro}</p>
      </div>
      <div
        role="img"
        data-clip-x
        aria-label={parts.map((part) => t.stats.added.total(part.name, part.count)).join(", ")}
        className="flex h-10 overflow-hidden rounded-full border-[3px] border-outline shadow-[var(--lift-sm)_var(--lift-sm)_0_var(--outline)]"
      >
        {parts.map((part, i) => (
          <span
            key={part.key}
            style={{ width: `${(part.count / total) * 100}%` }}
            className={`grid place-items-center ${part.color} ${i > 0 ? "border-l-[3px] border-outline" : ""}`}
          >
            <span className="display-ink text-xl leading-none text-ink">{part.count}</span>
          </span>
        ))}
      </div>
      <ul aria-hidden className="flex flex-wrap gap-x-5 gap-y-1.5">
        {parts.map((part) => (
          <li key={part.key} className="flex items-center gap-2 font-semibold">
            <span className={`size-3 rounded-full border-2 border-outline ${part.color}`} />
            {t.stats.added.total(part.name, part.count)}
          </li>
        ))}
      </ul>
    </section>
  );
}
