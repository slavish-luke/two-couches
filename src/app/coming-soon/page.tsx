import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { Burst } from "@/components/burst";
import { Couches } from "@/components/couch";
import { ListSync } from "@/components/list-sync";
import { PageLoading } from "@/components/page-loading";
import { Poster } from "@/components/poster";
import { RemindButton } from "@/components/remind-button";
import { TitleCard, type CardContext } from "@/components/title-card";
import { ALERT_STATUSES, describeAlert } from "@/lib/alert-rules";
import { countNewAlerts, getAlerts, getReminders, type Alert } from "@/lib/alerts";
import { type Messages } from "@/lib/i18n";
import { getI18n, localisedTitle } from "@/lib/i18n/server";
import { getList, getListKeys } from "@/lib/list";
import { formatDate, localDate } from "@/lib/list-rules";
import { countryName, isCountry } from "@/lib/places";
import { getPartner, requireProfile } from "@/lib/session";
import { getAvailability } from "@/lib/titles";
import { tmdbLocale } from "@/lib/tmdb";
import {
  cinemaReleases,
  digitalReleases,
  newEpisodes,
  nextEpisodes,
  releaseDates,
  type CountryReleases,
} from "@/lib/upcoming";
import { isMediaType, titleHref, titleKey, type MediaType, type TitleRef, type Watcher } from "@/lib/watch";
import { MarkAlertsSeen } from "./mark-seen";

export const generateMetadata = localisedTitle("comingSoon");

export default function ComingSoonPage({ searchParams }: PageProps<"/coming-soon">) {
  return (
    <Suspense fallback={<PageLoading variant="posters" />}>
      <ComingSoon searchParams={searchParams} />
    </Suspense>
  );
}

const ROW_LENGTH = 20;

/** Everything the page's sections share. */
type PageContext = {
  t: Messages;
  language: string;
  coupleId: string;
  locale: string;
  /** Both partners' TMDB locales, the viewer's first: for naming cached titles. */
  locales: string[];
  /** The countries you watch from, yours first. */
  countries: string[];
  today: string;
  card: Omit<CardContext, "availability">;
  /** titleKey() of every title with a reminder. */
  reminded: Set<string>;
};

/** Merges per-country lists, taking each list's first item, then each one's second, and so on, without repeats. */
function interleave<T extends TitleRef>(lists: T[][]) {
  const seen = new Set<string>();
  const merged: T[] = [];
  for (let i = 0; i < Math.max(0, ...lists.map((l) => l.length)); i++) {
    for (const item of lists.map((l) => l[i])) {
      if (item && !seen.has(titleKey(item))) {
        seen.add(titleKey(item));
        merged.push(item);
      }
    }
  }
  return merged;
}

/** "14 Nov", with the year when it isn't this year's. */
function shortDate(value: string, today: string, language: string) {
  if (value.slice(0, 4) !== today.slice(0, 4)) return formatDate(value, language);
  return new Intl.DateTimeFormat(language, { day: "numeric", month: "short", timeZone: "UTC" }).format(
    new Date(`${value}T00:00:00Z`),
  );
}

async function ComingSoon({ searchParams }: Pick<PageProps<"/coming-soon">, "searchParams">) {
  const [profile, partner, params, { language, t }] = await Promise.all([
    requireProfile(),
    getPartner(),
    searchParams,
    getI18n(),
  ]);
  if (!isCountry(profile.country)) redirect("/settings?welcome=1");
  if (!profile.couple_id) redirect("/couple");
  const coupleId = profile.couple_id;

  const type: MediaType = isMediaType(params.type) ? params.type : "movie";
  const locale = tmdbLocale(profile.language, profile.home_country ?? profile.country);
  const me: Watcher = { country: profile.country, services: profile.services };
  const them: Watcher | null = partner?.country ? { country: partner.country, services: partner.services } : null;
  const partnerName = partner?.display_name || t.common.yourPartner;

  const locales = partner?.country ? [locale, tmdbLocale(partner.language, partner.home_country)] : [locale];
  const [alerts, reminders, onList, newCount] = await Promise.all([
    getAlerts(coupleId, locales),
    getReminders(coupleId, locales),
    getListKeys(coupleId),
    countNewAlerts(profile.alerts_seen_at),
  ]);
  const context: PageContext = {
    t,
    language,
    coupleId,
    locale,
    locales,
    countries: them && them.country !== me.country ? [me.country, them.country] : [me.country],
    today: localDate(profile.time_zone),
    card: { language, me, them, partnerName, onList },
    reminded: new Set(reminders.map(titleKey)),
  };
  const remindersOfType = reminders.filter((r) => r.media_type === type);
  const reminderCard: CardContext = {
    ...context.card,
    availability: getAvailability(remindersOfType, context.countries),
  };

  return (
    <div className="grid gap-8">
      <ListSync coupleId={coupleId} />
      {newCount > 0 && <MarkAlertsSeen />}
      <div className="grid gap-3">
        <h1 className="display -rotate-1 text-[clamp(2.4rem,5vw,3.6rem)]">{t.upcoming.heading}</h1>
        <p className="max-w-[65ch] font-medium text-muted">{t.upcoming.intro}</p>
      </div>

      {/* New alerts are the news here, so they get the screen's spotlight; with none it's a quiet card. */}
      <section className={alerts.length === 0 ? "card grid gap-3" : "spotlight grid -rotate-1 gap-4 p-5"}>
        <h2 className={alerts.length === 0 ? "display-ink text-2xl" : "display-pop text-[2rem]"}>
          {t.upcoming.alerts.heading}
        </h2>
        {alerts.length === 0 ? (
          <div className="grid justify-items-start gap-3 sm:flex sm:items-center sm:gap-4">
            <Couches size={48} />
            <p className="max-w-prose font-medium text-muted">{t.upcoming.alerts.empty}</p>
          </div>
        ) : (
          <ul className="grid gap-3">
            {alerts.map((alert) => (
              <AlertRow
                key={alert.id}
                alert={alert}
                viewerId={profile.id}
                partner={partner ? { id: partner.id, name: partnerName } : null}
                context={context}
              />
            ))}
          </ul>
        )}
      </section>

      <nav aria-label={t.upcoming.typesLabel}>
        <ul className="-mx-1 flex items-center gap-3 overflow-x-auto px-1 pb-2 pt-1 [scrollbar-width:none]">
          {(["movie", "tv"] as const).map((mediaType) => (
            <li key={mediaType} className="shrink-0">
              <Link
                href={mediaType === "movie" ? "/coming-soon" : `/coming-soon?type=${mediaType}`}
                aria-current={type === mediaType ? "page" : undefined}
                className="tab block"
              >
                {t.common.mediaTypePlural[mediaType]}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {remindersOfType.length > 0 && (
        <Row heading={t.upcoming.reminders.heading} note={t.upcoming.reminders.note}>
          {remindersOfType.map((r) => (
            <TitleCard key={titleKey(r)} result={r} context={reminderCard} className="w-36 shrink-0 snap-start">
              <RemindButton titleRef={{ media_type: r.media_type, tmdb_id: r.tmdb_id }} reminded language={language} />
            </TitleCard>
          ))}
        </Row>
      )}

      <Suspense fallback={<p className="font-semibold text-muted motion-safe:animate-pulse">{t.upcoming.loading}</p>}>
        {type === "movie" ? <FilmSections context={context} /> : <SeriesSections context={context} />}
      </Suspense>
    </div>
  );
}

function AlertRow(props: {
  alert: Alert;
  viewerId: string;
  partner: { id: string; name: string } | null;
  context: PageContext;
}) {
  const { alert, context } = props;
  const { heading, detail } = describeAlert(alert, props.viewerId, props.partner, context.t.upcoming.alerts);
  const day = alert.created_at.slice(0, 10);
  return (
    <li className="paper tilt-row relative flex items-center gap-4 rounded-control border-[3px] border-outline p-3 pr-4">
      <Poster path={alert.poster_path} title={alert.title} size="sm" language={context.language} />
      <div className="grid min-w-0 flex-1 gap-0.5">
        <Link href={titleHref(alert)} className="text-lg font-bold leading-tight hover:underline">
          {alert.title}
        </Link>
        <p className="font-semibold">{heading}</p>
        {detail && <p className="text-sm font-medium text-muted">{detail}</p>}
        <p className="text-[13px] font-medium text-muted">{shortDate(day, context.today, context.language)}</p>
      </div>
      {alert.kind === "both" && (
        <Burst className="size-16 shrink-0 max-sm:absolute max-sm:-right-3 max-sm:-top-4" textClass="text-[13px]">
          <span aria-hidden>{context.t.common.watchBadge.stampShort}</span>
        </Burst>
      )}
    </li>
  );
}

/** A heading and a horizontally scrolling row of cards. */
function Row({ heading, note, children }: { heading: string; note?: string; children: ReactNode }) {
  return (
    <section className="grid gap-1">
      <h2 className="display text-[2rem]">{heading}</h2>
      {note && <p className="max-w-[65ch] text-sm font-medium text-muted">{note}</p>}
      {/* Room above for the bursts and below for the hover lift and shadows, which the scroller would clip. */}
      <ul className="-mx-4 flex snap-x scroll-px-4 gap-4 overflow-x-auto px-4 pb-4 pt-6">{children}</ul>
    </section>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="card flex items-center gap-4">
      <Couches size={48} />
      <p className="font-medium text-muted">{text}</p>
    </div>
  );
}

/** Films in cinemas and coming to digital in either country, with the date in each. */
async function FilmSections({ context }: { context: PageContext }) {
  const { t, countries, locale } = context;
  const [cinemaLists, digitalLists] = await Promise.all([
    Promise.allSettled(countries.map((c) => cinemaReleases(c, locale))),
    Promise.allSettled(countries.map((c) => digitalReleases(c, locale))),
  ]);
  const fulfilled = <T,>(lists: PromiseSettledResult<T[]>[]) =>
    lists.flatMap((l) => (l.status === "fulfilled" ? [l.value] : []));
  const failed = [...cinemaLists, ...digitalLists].every((l) => l.status === "rejected");
  if (failed) {
    console.error("Loading upcoming films failed", cinemaLists[0]);
    return <Empty text={t.upcoming.failed} />;
  }

  const cinema = interleave(fulfilled(cinemaLists)).slice(0, ROW_LENGTH);
  const digital = interleave(fulfilled(digitalLists)).slice(0, ROW_LENGTH);
  const dates = await releaseDates([...cinema, ...digital].map((r) => r.tmdb_id), countries);
  const card: CardContext = { ...context.card, availability: null };

  const rows = [
    { key: "cinema" as const, text: t.upcoming.cinemas, items: cinema },
    { key: "digital" as const, text: t.upcoming.digital, items: digital },
  ];
  return (
    <div className="grid gap-8">
      {rows.map((row) =>
        row.items.length === 0 ? null : (
          <Row key={row.key} heading={row.text.heading} note={row.text.note}>
            {row.items.map((r) => (
              <TitleCard
                key={titleKey(r)}
                result={r}
                context={card}
                className="w-36 shrink-0 snap-start"
                details={<ReleaseLines releases={dates[r.tmdb_id]} kind={row.key} context={context} />}
              >
                <RemindButton
                  titleRef={{ media_type: r.media_type, tmdb_id: r.tmdb_id }}
                  reminded={context.reminded.has(titleKey(r))}
                  language={context.language}
                />
              </TitleCard>
            ))}
          </Row>
        ),
      )}
      {rows.every((row) => row.items.length === 0) && <Empty text={t.upcoming.nothingHere} />}
    </div>
  );
}

/** One line per country: its chip and the film's cinema (or digital) release date there. */
function ReleaseLines(props: {
  releases: Record<string, CountryReleases> | undefined;
  kind: keyof CountryReleases;
  context: PageContext;
}) {
  const { countries, language, today, t } = props.context;
  return (
    <ul className="grid justify-items-start gap-1">
      {countries.map((country, i) => {
        const date = props.releases?.[country]?.[props.kind];
        return (
          // A split tag: the country in that person's colour, then its date there.
          <li
            key={country}
            className="flex items-stretch overflow-hidden rounded-full border-2 border-outline bg-surface text-[13px] font-semibold leading-snug"
          >
            <span
              title={countryName(country, language)}
              className={`border-r-2 border-outline px-1.5 font-bold ${i === 0 ? "bg-me" : "bg-partner"}`}
            >
              {country}
            </span>
            <span className={`px-1.5 ${date ? "" : "text-muted"}`}>
              {date ? shortDate(date, today, language) : t.upcoming.noDate}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/** Next episodes of series on our list, and series with new episodes soon on the services you pay for. */
async function SeriesSections({ context }: { context: PageContext }) {
  const { t, card: base, locale } = context;
  const list = (await getList(context.coupleId, context.locales)).filter(
    (item) => item.media_type === "tv" && ALERT_STATUSES.includes(item.status),
  );
  const people = [base.me, ...(base.them ? [base.them] : [])];
  const [next, episodeLists] = await Promise.all([
    nextEpisodes(list.map((item) => item.tmdb_id)),
    Promise.allSettled(people.map((p) => newEpisodes(p.country, p.services, locale))),
  ]);
  if (episodeLists.every((l) => l.status === "rejected")) {
    console.error("Loading new episodes failed", episodeLists[0]);
  }

  const upcoming = list
    .filter((item) => next[item.tmdb_id])
    .toSorted((a, b) => next[a.tmdb_id].air_date.localeCompare(next[b.tmdb_id].air_date));
  const fresh = interleave(episodeLists.flatMap((l) => (l.status === "fulfilled" ? [l.value] : []))).slice(
    0,
    ROW_LENGTH,
  );
  const card: CardContext = { ...base, availability: getAvailability([...upcoming, ...fresh], context.countries) };

  return (
    <div className="grid gap-8">
      {upcoming.length > 0 && (
        <Row heading={t.upcoming.nextOnList.heading} note={t.upcoming.nextOnList.note}>
          {upcoming.map((item) => {
            const episode = next[item.tmdb_id];
            return (
              <TitleCard
                key={titleKey(item)}
                result={item}
                context={card}
                className="w-36 shrink-0 snap-start"
                details={
                  <span className="grid justify-items-start gap-1 text-[13px]">
                    <span className="font-semibold">
                      {t.common.progress(episode.season, episode.episode)} ·{" "}
                      {shortDate(episode.air_date, context.today, context.language)}
                    </span>
                    {episode.episode === 1 && (
                      <span className="rounded-full border-2 border-outline bg-accent-soft px-2 font-bold leading-snug">
                        {t.upcoming.seasonPremiere}
                      </span>
                    )}
                  </span>
                }
              />
            );
          })}
        </Row>
      )}
      {fresh.length > 0 && (
        <Row heading={t.upcoming.newEpisodes.heading} note={t.upcoming.newEpisodes.note}>
          {fresh.map((r) => (
            <TitleCard key={titleKey(r)} result={r} context={card} className="w-36 shrink-0 snap-start" />
          ))}
        </Row>
      )}
      {upcoming.length === 0 && fresh.length === 0 && (
        <Empty text={episodeLists.every((l) => l.status === "rejected") ? t.upcoming.failed : t.upcoming.nothingHere} />
      )}
    </div>
  );
}
