import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ListSync } from "@/components/list-sync";
import { PageLoading } from "@/components/page-loading";
import { Poster } from "@/components/poster";
import { Stars } from "@/components/stars";
import { getGenres } from "@/lib/browse";
import type { Messages } from "@/lib/i18n";
import { getI18n, localisedTitle } from "@/lib/i18n/server";
import { getList } from "@/lib/list";
import { localDate } from "@/lib/list-rules";
import { getNightStarts } from "@/lib/nights";
import { isCountry } from "@/lib/places";
import { getPartner, requireProfile } from "@/lib/session";
import { computeStats, statsYears, type Period, type StatsEntry } from "@/lib/stats-rules";
import { tmdbLocale } from "@/lib/tmdb";
import { titleHref } from "@/lib/watch";

export const generateMetadata = localisedTitle("stats");

export default function StatsPage({ searchParams }: PageProps<"/stats">) {
  return (
    <Suspense fallback={<PageLoading />}>
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
  const [entries, nightStarts, movieGenres, tvGenres] = await Promise.all([
    getList(profile.couple_id, locales),
    getNightStarts(profile.couple_id),
    getGenres("movie", locale).catch(() => []),
    getGenres("tv", locale).catch(() => []),
  ]);
  const genreNames = new Map([...movieGenres, ...tvGenres].map((g) => [g.id, g.name]));

  const now = new Date();
  const thisYear = Number(localDate(profile.time_zone, now).slice(0, 4));
  const years = statsYears(entries, thisYear);
  const period: Period = params.year === "all" ? "all" : years.includes(Number(params.year)) ? Number(params.year) : thisYear;
  const stats = computeStats(entries, nightStarts, {
    period,
    meId: profile.id,
    partnerId: partner?.id ?? null,
    timeZone: profile.time_zone,
    now,
  });
  const partnerName = partner ? partner.display_name || t.common.yourPartner : null;
  const nothingWatched = stats.films + stats.series === 0;
  const number = (value: number) => new Intl.NumberFormat(language).format(value);

  const chip = (active: boolean) =>
    `rounded-full border px-3 py-1 transition ${active ? "border-ink bg-ink text-bg" : "border-line text-muted hover:text-ink"}`;

  return (
    <div className="grid gap-8">
      <ListSync coupleId={profile.couple_id} />
      <div className="grid gap-3">
        <h1 className="font-display text-3xl font-bold tracking-tight">{t.stats.heading}</h1>
        <nav aria-label={t.stats.periodsLabel} className="flex flex-wrap gap-2 text-sm font-semibold">
          {[...years, "all" as const].map((year) => (
            <Link
              key={year}
              href={year === thisYear ? "/stats" : `/stats?year=${year}`}
              aria-current={period === year ? "page" : undefined}
              className={chip(period === year)}
            >
              {year === "all" ? t.stats.allTime : year}
            </Link>
          ))}
        </nav>
        <p className="text-muted">{t.stats.intro(period === "all" ? null : period)}</p>
      </div>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {(
          [
            ["films", number(stats.films)],
            ["series", number(stats.series)],
            ["hours", number(Math.round(stats.minutes / 60))],
            ["nights", number(stats.nights)],
          ] as const
        ).map(([key, value]) => (
          <div key={key} className="card grid content-start gap-1 p-4">
            <dt className="text-sm text-muted">{t.stats.tiles[key]}</dt>
            <dd className="font-display text-3xl font-semibold tabular-nums">
              {key === "hours" && stats.minutesIncomplete && stats.minutes > 0 && (
                <span className="mr-1 align-middle font-sans text-sm font-normal text-muted">{t.stats.atLeast}</span>
              )}
              {value}
            </dd>
          </div>
        ))}
      </dl>

      {nothingWatched ? (
        <div className="card grid justify-items-center gap-1 py-10 text-center">
          <p className="font-semibold">{period === "all" ? t.stats.empty.heading : t.stats.empty.year(period)}</p>
          {period === "all" && <p className="text-sm text-muted">{t.stats.empty.body}</p>}
          <Link href="/?view=watched" className="mt-1 text-sm font-semibold text-partner">
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
    </div>
  );
}

/** Titles finished each month: one column per month, the busiest labelled, every one hoverable. */
function MonthChart({ months, language, t }: { months: number[]; language: string; t: Messages }) {
  const max = Math.max(...months, 1);
  const busiest = months.indexOf(Math.max(...months));
  const name = (i: number, month: "long" | "narrow") =>
    new Intl.DateTimeFormat(language, { month, timeZone: "UTC" }).format(new Date(Date.UTC(2000, i, 1)));
  return (
    <section className="card grid gap-4">
      <h2 className="font-display text-lg font-semibold">{t.stats.months.heading}</h2>
      <ol className="grid h-36 grid-cols-12 items-end gap-0.5 border-b border-line">
        {months.map((count, i) => (
          <li
            key={i}
            tabIndex={0}
            aria-label={t.stats.months.count(name(i, "long"), count)}
            className="group relative flex h-full flex-col items-center justify-end outline-none"
          >
            {count > 0 && i === busiest && (
              <span aria-hidden className="mb-1 text-xs font-semibold tabular-nums text-muted">
                {count}
              </span>
            )}
            <span
              aria-hidden
              style={{ height: `${(count / max) * 100}%` }}
              className="w-full max-w-6 rounded-t bg-both transition group-hover:opacity-80 group-focus-visible:opacity-80"
            />
            <span
              aria-hidden
              className="pointer-events-none invisible absolute bottom-full z-10 mb-1 whitespace-nowrap rounded-md bg-ink px-2 py-1 text-xs font-semibold text-bg group-hover:visible group-focus-visible:visible"
            >
              {t.stats.months.count(name(i, "long"), count)}
            </span>
          </li>
        ))}
      </ol>
      <div aria-hidden className="-mt-2 grid grid-cols-12 gap-0.5 text-center text-xs text-muted">
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
    <section className="card grid gap-4">
      <h2 className="font-display text-lg font-semibold">{t.stats.genres.heading}</h2>
      <ol className="grid gap-3">
        {genres.map((genre) => (
          <li key={genre.id} className="grid grid-cols-[minmax(6rem,9rem)_1fr] items-center gap-3 text-sm">
            <span className="truncate">{genre.name}</span>
            <span className="flex items-center gap-2">
              <span style={{ width: `${(genre.count / max) * 100}%` }} className="h-4 max-w-[calc(100%-2rem)] rounded-r bg-both" />
              <span className="font-semibold tabular-nums">{genre.count}</span>
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
      <span className="font-semibold tabular-nums">
        {new Intl.NumberFormat(language, { maximumFractionDigits: 1 }).format(value)} ★
      </span>
    );
  const both = (entry: StatsEntry) =>
    partner && (
      <span className="flex flex-wrap gap-x-3 text-sm">
        <span>
          {t.common.you} <Stars rating={entry.ratings[meId]} who={t.common.you} language={language} />
        </span>
        <span>
          {partner.name} <Stars rating={entry.ratings[partner.id]} who={partner.name} language={language} />
        </span>
      </span>
    );
  const titleRow = (entry: StatsEntry) => (
    <Link href={titleHref(entry)} className="flex items-center gap-3 rounded-lg p-1 transition hover:bg-bg">
      <Poster path={entry.poster_path} title={entry.title} size="xs" language={language} />
      <span className="grid gap-0.5">
        <span className="font-semibold leading-snug">{entry.title}</span>
        {both(entry)}
      </span>
    </Link>
  );

  return (
    <section className="card grid gap-5">
      <h2 className="font-display text-lg font-semibold">{t.stats.ratings.heading}</h2>
      <div className="grid gap-1">
        <h3 className="text-sm text-muted">{t.stats.ratings.average}</h3>
        <dl className="flex flex-wrap gap-x-6 gap-y-1">
          <div className="flex gap-2">
            <dt>{t.common.you}</dt>
            <dd>{average(stats.averages.me)}</dd>
          </div>
          {partner && (
            <div className="flex gap-2">
              <dt>{partner.name}</dt>
              <dd>{average(stats.averages.partner)}</dd>
            </div>
          )}
        </dl>
      </div>
      {stats.favourites.length > 0 && (
        <div className="grid gap-2">
          <h3 className="text-sm text-muted">{t.stats.ratings.favourites}</h3>
          <ol className="grid gap-1">
            {stats.favourites.map((entry) => (
              <li key={entry.id}>{titleRow(entry)}</li>
            ))}
          </ol>
        </div>
      )}
      {stats.split && (
        <div className="grid gap-2">
          <h3 className="text-sm text-muted">
            {t.stats.ratings.split} · {t.stats.ratings.splitIntro}
          </h3>
          {titleRow(stats.split)}
        </div>
      )}
    </section>
  );
}

/** One thin bar split between the two of you (ochre and teal), named in the legend below it. */
function AddedBar({ added, partnerName, t }: { added: { me: number; partner: number }; partnerName: string; t: Messages }) {
  const total = added.me + added.partner;
  const parts = [
    { key: "me", name: t.common.you, count: added.me, color: "bg-me" },
    { key: "partner", name: partnerName, count: added.partner, color: "bg-partner" },
  ].filter((part) => part.count > 0);
  return (
    <section className="card grid gap-3">
      <div className="grid gap-1">
        <h2 className="font-display text-lg font-semibold">{t.stats.added.heading}</h2>
        <p className="text-sm text-muted">{t.stats.added.intro}</p>
      </div>
      <div
        role="img"
        aria-label={parts.map((part) => t.stats.added.total(part.name, part.count)).join(", ")}
        className="flex h-2 gap-0.5"
      >
        {parts.map((part) => (
          <span key={part.key} style={{ width: `${(part.count / total) * 100}%` }} className={`rounded-full ${part.color}`} />
        ))}
      </div>
      <ul aria-hidden className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
        {parts.map((part) => (
          <li key={part.key} className="flex items-center gap-2">
            <span className={`size-2.5 rounded-full ${part.color}`} />
            {t.stats.added.total(part.name, part.count)}
          </li>
        ))}
      </ul>
    </section>
  );
}
