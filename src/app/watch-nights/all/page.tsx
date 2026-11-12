/* eslint-disable @next/next/no-img-element -- Private photos from signed Storage URLs: next/image would send them through the image loader, which is for TMDB's posters. */
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { Couches } from "@/components/couch";
import { BackIcon, PlusIcon, RepeatIcon } from "@/components/icons";
import { ListSync } from "@/components/list-sync";
import { Poster } from "@/components/poster";
import { Stars } from "@/components/stars";
import type { Messages } from "@/lib/i18n";
import { getI18n, localisedTitle } from "@/lib/i18n/server";
import { formatDate, localDate } from "@/lib/list-rules";
import { formatDay, formatTime } from "@/lib/night-rules";
import { dateLocale, isCountry } from "@/lib/places";
import { getPartner, requireProfile } from "@/lib/session";
import { streaks } from "@/lib/taste-rules";
import { getPastNights, getTimelineEntries, signThumbs, type PastNight } from "@/lib/time";
import { nightDate, nightRatings, TIMELINE_STEP, timelineMarks, type TimelineMilestone } from "@/lib/time-rules";
import { tmdbLocale } from "@/lib/tmdb";
import { titleHref, titleKey } from "@/lib/watch";
import { AllNightsSkeleton } from "./skeleton";

export const generateMetadata = localisedTitle("allNights");

export default function AllNightsPage({ searchParams }: PageProps<"/watch-nights/all">) {
  return (
    <Suspense fallback={<AllNightsSkeleton />}>
      <AllNights searchParams={searchParams} />
    </Suspense>
  );
}

/** How many nights to show: `?n=60` after "Show older nights", in steps of TIMELINE_STEP. */
function shownCount(value: unknown) {
  const n = typeof value === "string" ? Number(value) : NaN;
  return Number.isSafeInteger(n) && n > TIMELINE_STEP ? Math.ceil(n / TIMELINE_STEP) * TIMELINE_STEP : TIMELINE_STEP;
}

type Person = { id: string; name: string; timeZone: string };

async function AllNights({ searchParams }: Pick<PageProps<"/watch-nights/all">, "searchParams">) {
  const [profile, partner, params, { language, t }] = await Promise.all([
    requireProfile(),
    getPartner(),
    searchParams,
    getI18n(),
  ]);
  if (!isCountry(profile.country)) redirect("/settings?welcome=1");
  if (!profile.couple_id) redirect("/couple");

  const locale = tmdbLocale(profile.language, profile.home_country ?? profile.country);
  const locales = partner?.country ? [locale, tmdbLocale(partner.language, partner.home_country)] : [locale];
  const zones: Record<string, string> = { [profile.id]: profile.time_zone, ...(partner && { [partner.id]: partner.time_zone }) };
  const now = new Date();
  const [nights, entries] = await Promise.all([
    getPastNights(profile.couple_id, locales, zones, profile.time_zone, now),
    getTimelineEntries(profile.couple_id),
  ]);

  const me: Person = { id: profile.id, name: t.common.you, timeZone: profile.time_zone };
  const them: Person | null = partner && { id: partner.id, name: partner.display_name || t.common.yourPartner, timeZone: partner.time_zone };
  const today = localDate(profile.time_zone, now);
  const { numbers, marks, anniversaries } = timelineMarks(nights, entries, now, today);
  const streak = streaks(nights, now, profile.time_zone);
  const oldest = nights.at(-1);

  const count = shownCount(params.n);
  const shown = nights.slice(0, count);
  const more = nights.length > shown.length;
  const urls = await signThumbs(shown.flatMap((n) => n.thumbs));
  const byTitle = new Map(entries.map((e) => [titleKey(e), e]));

  // Newest first, grouped by month on your clock, with each anniversary just above the nights before it.
  const monthOf = new Intl.DateTimeFormat(dateLocale(language), { month: "long", year: "numeric", timeZone: profile.time_zone });
  const months: { label: string; rows: ReactNode[] }[] = [];
  const pending = anniversaries.toSorted((a, b) => b.date.localeCompare(a.date));
  const push = (label: string, row: ReactNode) => {
    const last = months.at(-1);
    if (last?.label === label) last.rows.push(row);
    else months.push({ label, rows: [row] });
  };
  for (const night of shown) {
    const date = nightDate(night);
    while (pending[0] && pending[0].date > date) {
      const a = pending.shift()!;
      push(monthOf.format(new Date(`${a.date}T12:00:00Z`)), <AnniversaryRow key={`a${a.years}`} milestone={a} language={language} t={t} />);
    }
    push(
      monthOf.format(new Date(night.starts_at)),
      <NightRow
        key={night.id}
        night={night}
        number={numbers.get(night.id) ?? 0}
        marks={marks.get(night.id) ?? []}
        ratings={night.title ? nightRatings(byTitle.get(titleKey(night.title)), [localDate(me.timeZone, new Date(night.starts_at)), ...(them ? [localDate(them.timeZone, new Date(night.starts_at))] : [])]) : null}
        urls={urls}
        me={me}
        partner={them}
        language={language}
        t={t}
      />,
    );
  }

  const text = t.time.timeline;
  return (
    <div className="grid gap-8">
      <ListSync coupleId={profile.couple_id} />
      <div className="grid gap-3">
        <Link href="/watch-nights" className="group inline-flex items-center gap-1.5 justify-self-start font-bold underline underline-offset-4">
          <BackIcon className="size-4 transition-transform duration-200 ease-(--ease-spring) group-hover:-translate-x-1" /> {text.back}
        </Link>
        <h1 className="display -rotate-1 text-[clamp(2.4rem,5vw,3.6rem)]">{text.heading}</h1>
        <p className="max-w-[34rem] font-medium text-muted">{text.intro}</p>
      </div>

      {nights.length === 0 ? (
        <div className="card grid justify-items-center gap-4 py-10 text-center">
          <Couches size={56} />
          <p className="max-w-[28rem] text-lg font-bold">{text.empty}</p>
          <Link href="/watch-nights/new" className="btn">
            <PlusIcon className="size-5 [stroke-width:3]" />
            {text.emptyLink}
          </Link>
        </div>
      ) : (
        <>
          <div data-timeline-summary className="card flex flex-wrap items-baseline gap-x-6 gap-y-2 py-4">
            <p className="flex flex-wrap items-baseline gap-x-2">
              <span className="display-ink text-3xl">{text.nights(nights.length)}</span>
              {oldest && <span className="text-sm font-semibold text-muted">{text.since(formatDate(nightDate(oldest), language))}</span>}
            </p>
            {streak.current > 0 && <p className="font-bold">{text.streak(streak.current)}</p>}
            {streak.best > Math.max(1, streak.current) && <p className="font-semibold text-muted">{text.best(streak.best)}</p>}
          </div>

          {/* A line down the side with each night hanging off it. */}
          <div data-timeline className="grid gap-8">
            {months.map((month) => (
              <section key={month.label} className="grid gap-4">
                <h2 className="display text-[1.75rem] capitalize">{month.label}</h2>
                <ol className="relative grid gap-4 pl-6 before:absolute before:-bottom-2 before:left-[5px] before:top-3 before:w-[7px] before:rounded-full before:border-2 before:border-outline before:bg-surface sm:pl-8 sm:before:left-[9px]">
                  {month.rows}
                </ol>
              </section>
            ))}
          </div>

          {more && (
            <Link href={`/watch-nights/all?n=${count + TIMELINE_STEP}`} scroll={false} className="btn-quiet justify-self-center">
              {text.showMore}
            </Link>
          )}
        </>
      )}
    </div>
  );
}

/** The dot where a row hangs off the line. */
function Knot({ className = "bg-surface" }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={`absolute -left-6 top-5 size-[17px] rounded-full border-[3px] border-outline sm:-left-8 sm:size-[25px] ${className}`}
    />
  );
}

function NightRow(props: {
  night: PastNight;
  number: number;
  marks: TimelineMilestone[];
  ratings: ReturnType<typeof nightRatings>;
  urls: Map<string, string>;
  me: Person;
  partner: Person | null;
  language: string;
  t: Messages;
}) {
  const { night, marks, ratings, me, partner, language, t } = props;
  const text = t.time.timeline;
  const start = new Date(night.starts_at);
  const thumbs = night.thumbs.flatMap((path) => {
    const url = props.urls.get(path);
    return url ? [url] : [];
  });
  const people = [me, ...(partner ? [partner] : [])];
  const rated = ratings && people.some((p) => ratings.ratings[p.id]);

  return (
    <li data-timeline-night className="relative">
      <Knot className={marks.length > 0 ? "bg-pop" : "bg-surface"} />
      <article className="card grid grid-cols-[3.5rem_minmax(0,1fr)] gap-x-3 gap-y-2 p-3 sm:grid-cols-[4.5rem_minmax(0,1fr)] sm:gap-x-4 sm:p-4">
        <Poster
          path={night.poster_path}
          title={night.name ?? ""}
          size="sm"
          language={language}
          className="row-span-2 w-14 self-start sm:w-[4.5rem]"
        />
        <div className="grid min-w-0 content-start gap-1">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-semibold text-muted">
            <span className="rounded-full border-2 border-outline bg-surface px-2 text-[13px] font-bold leading-snug text-ink">
              {text.number(props.number)}
            </span>
            <span>
              {formatDay(start, me.timeZone, language)}, {formatTime(start, me.timeZone, language)}
            </span>
          </p>
          {night.title && night.name ? (
            <Link href={titleHref(night.title)} data-item-title className="text-lg font-bold leading-snug hover:underline sm:text-xl">
              {night.name}
            </Link>
          ) : (
            <span className="text-lg font-bold leading-snug text-muted sm:text-xl">{text.decideLater}</span>
          )}
          {marks.length > 0 && (
            <ul className="flex flex-wrap gap-1.5 pt-0.5">
              {marks.map((m) => (
                <li
                  key={m.kind}
                  className="-rotate-2 rounded-[10px] border-2 border-outline bg-pop px-2 text-[13px] font-bold leading-snug shadow-[2px_2px_0_var(--outline)]"
                >
                  {m.kind === "first" ? text.first : m.kind === "film" ? text.film(m.number) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="col-span-2 grid gap-2 sm:col-span-1 sm:col-start-2">
          {night.title && (
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
              {ratings?.rewatch && (
                <span className="inline-flex items-center gap-1 font-bold">
                  <RepeatIcon className="size-4" />
                  {text.rewatch}
                </span>
              )}
              {ratings && rated ? (
                people.map((p) =>
                  ratings.ratings[p.id] ? (
                    <span key={p.id} className="inline-flex items-center gap-1">
                      <span aria-hidden className={`size-2.5 rounded-full border-2 border-outline ${p.id === me.id ? "bg-me" : "bg-partner"}`} />
                      {p.name} <Stars rating={ratings.ratings[p.id]} who={p.name} language={language} />
                    </span>
                  ) : null,
                )
              ) : (
                <span className="text-muted">{text.notRated}</span>
              )}
            </p>
          )}
          {night.photoCount > 0 && thumbs.length > 0 && (
            <div className="flex items-center gap-2" aria-label={text.photos(night.photoCount)} role="group">
              {thumbs.map((url) => (
                <span key={url} className="block size-14 overflow-hidden rounded-[10px] border-[2.5px] border-outline bg-accent-soft sm:size-16">
                  <img src={url} alt="" loading="lazy" decoding="async" className="size-full object-cover" />
                </span>
              ))}
              {night.photoCount > thumbs.length && (
                <span className="text-sm font-bold">{text.more(night.photoCount - thumbs.length)}</span>
              )}
            </div>
          )}
        </div>
      </article>
    </li>
  );
}

/** A year since your first night, between the nights either side of it. */
function AnniversaryRow({
  milestone,
  language,
  t,
}: {
  milestone: Extract<TimelineMilestone, { kind: "anniversary" }>;
  language: string;
  t: Messages;
}) {
  return (
    <li data-timeline-anniversary className="relative">
      <Knot className="bg-accent" />
      <div className="inline-flex -rotate-1 flex-wrap items-center gap-x-3 gap-y-1 rounded-panel border-[3px] border-outline bg-pop px-4 py-2.5 text-ink shadow-[4px_4px_0_var(--outline)]">
        <Couches size={30} />
        <span className="display-ink text-xl">{t.time.timeline.anniversary(milestone.years)}</span>
        <span className="text-sm font-semibold">{formatDate(milestone.date, language)}</span>
      </div>
    </li>
  );
}
