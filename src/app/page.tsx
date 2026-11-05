import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AvailabilityBadge } from "@/components/availability-badge";
import { Couch, Couches } from "@/components/couch";
import { ListSync } from "@/components/list-sync";
import { Poster, posterMorph } from "@/components/poster";
import { SearchBox } from "@/components/search-box";
import { Stars } from "@/components/stars";
import { VenueClock } from "@/components/venue-clock";
import { ArrowIcon } from "@/components/icons";
import { getList, type ListEntry } from "@/lib/list";
import { getWatchNights } from "@/lib/nights";
import { getMessages, type Messages } from "@/lib/i18n";
import { getI18n } from "@/lib/i18n/server";
import { formatDate, localDate, shortDate, type ListStatus } from "@/lib/list-rules";
import { countryName, hoursApart } from "@/lib/places";
import { getPartner, requireProfile } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { getAvailability } from "@/lib/titles";
import { tmdbLocale } from "@/lib/tmdb";
import { isMediaType, titleHref, titleKey, whoCanWatch, type Availability, type MediaType, type Watcher } from "@/lib/watch";
import { AfterNight } from "./after-night/after-night";
import { HomeSkeleton, ListSkeleton, PickLinkSkeleton } from "./home-skeleton";
import { PickLink } from "./pick/pick-link";
import { VisitChip } from "./settings/visit-chip";
import { NightCard } from "./watch-nights/night-card";

export default function HomePage({ searchParams }: PageProps<"/">) {
  return (
    <Suspense fallback={<HomeSkeleton />}>
      <OurList searchParams={searchParams} />
    </Suspense>
  );
}

const VIEWS = {
  next: { statuses: ["watching", "want"] },
  watched: { statuses: ["watched"] },
  dropped: { statuses: ["dropped"] },
} satisfies Record<string, { statuses: ListStatus[] }>;

type View = keyof typeof VIEWS;

/** The list's filters, as read from and written to the URL. */
type Filters = { view: View; category: string | null; type: MediaType | null; both: boolean };

function filtersHref(filters: Filters, changes: Partial<Filters>) {
  const next = { ...filters, ...changes };
  const params = new URLSearchParams();
  if (next.view !== "next") params.set("view", next.view);
  if (next.category) params.set("category", next.category);
  if (next.type) params.set("type", next.type);
  if (next.both) params.set("both", "1");
  const query = params.toString();
  return query ? `/?${query}` : "/";
}

function sortEntries(view: View, entries: ListEntry[]) {
  const byNewest = (a: string | null, b: string | null) => (b ?? "").localeCompare(a ?? "");
  return entries.toSorted((a, b) => {
    if (view === "next") return Number(b.status === "watching") - Number(a.status === "watching") || byNewest(a.created_at, b.created_at);
    if (view === "watched") return byNewest(a.watched_on, b.watched_on) || byNewest(a.updated_at, b.updated_at);
    return byNewest(a.updated_at, b.updated_at);
  });
}

/** "You · 4 Nov", "{partner} · 4 Nov", or just "Added 4 Nov" for anyone else. */
function addedLine(t: Messages, entry: ListEntry, myId: string, partner: { id: string; name: string } | null, date: string) {
  if (entry.added_by === myId) return t.list.addedByYou(date);
  if (partner && entry.added_by === partner.id) return t.list.addedBy(partner.name, date);
  return t.list.addedOn(date);
}

async function OurList({ searchParams }: Pick<PageProps<"/">, "searchParams">) {
  const profile = await requireProfile();
  if (!profile.country) redirect("/settings?welcome=1");
  if (!profile.couple_id) redirect("/couple");

  const supabase = await createClient();
  const [{ data: members }, partner, params, { language, t }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, display_name, country, time_zone, visiting_country, visiting_until")
      .eq("couple_id", profile.couple_id)
      .order("created_at"),
    getPartner(),
    searchParams,
    getI18n(),
  ]);
  const now = new Date();
  const people = [members?.find((m) => m.id === profile.id), members?.find((m) => m.id !== profile.id)];
  const [mine, theirs] = people;

  return (
    <div data-wide className="grid grid-cols-[minmax(0,1fr)] gap-x-8 gap-y-8 lg:grid-cols-12">
      <aside className="grid min-w-0 content-start gap-7 lg:col-span-5 xl:col-span-4">
        <section
          aria-label={t.list.people.label}
          className="card relative grid grid-cols-2 items-start gap-2 px-3 pb-4 pt-3"
        >
          {people.map((person, i) => {
            const slot = i === 0 ? "col-start-1" : "col-start-2";
            if (!person) {
              return (
                <Link
                  key={i}
                  href="/couple"
                  className={`${slot} row-start-1 grid justify-items-center gap-1.5 self-center text-center`}
                >
                  <span className="font-bold">{t.list.people.waiting}</span>
                  <span className="inline-flex items-center gap-1 text-sm font-semibold text-muted underline underline-offset-4">
                    {t.list.people.shareInvite} <ArrowIcon />
                  </span>
                </Link>
              );
            }
            const isMe = person.id === profile.id;
            return (
              <div
                key={person.id}
                className={`${slot} @container row-start-1 grid min-w-0 content-start justify-items-center gap-1.5 text-center`}
              >
                <Couch who={isMe ? "me" : "partner"} size={58} />
                <span
                  className={`flex max-w-full items-center gap-1 rounded-full border-[2.5px] border-outline px-2.5 text-sm font-bold ${isMe ? "bg-me" : "bg-partner"}`}
                >
                  <span className="truncate">{isMe ? t.common.you : person.display_name || t.list.people.noName}</span>
                  {person.country && (
                    <span title={countryName(person.country, profile.language)} className="shrink-0 opacity-75">
                      · {person.country}
                    </span>
                  )}
                </span>
                {person.country ? (
                  <VenueClock timeZone={person.time_zone} language={profile.language} serverNow={now.getTime()} />
                ) : (
                  <span className="text-sm text-muted">{t.list.people.settingUp}</span>
                )}
                <VisitChip person={person} language={profile.language} now={now} />
              </div>
            );
          })}
          {mine?.country && theirs?.country && (
            <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 -rotate-6 whitespace-nowrap rounded-full border-[3px] border-outline bg-accent px-2.5 pb-0.5 pt-1 font-display text-sm leading-none tracking-[0.03em] text-on-accent shadow-[3px_3px_0_var(--outline)] sm:px-3 sm:pb-1 sm:pt-1.5 sm:text-base">
              {t.list.people.apart(hoursApart(now, mine.time_zone, theirs.time_zone))}
            </span>
          )}
        </section>

        {/* No boundary of its own: the spotlight arrives with the aside, so nothing below it jumps when it does. */}
        {partner && (
          <NextNight
            coupleId={profile.couple_id}
            me={{ id: profile.id, name: t.common.you, timeZone: profile.time_zone }}
            partner={{ id: partner.id, name: partner.display_name || t.common.yourPartner, timeZone: partner.time_zone }}
            locales={
              partner.country
                ? [tmdbLocale(profile.language, profile.home_country), tmdbLocale(partner.language, partner.home_country)]
                : [tmdbLocale(profile.language, profile.home_country)]
            }
          />
        )}
        <AfterNight />

        <div className="grid gap-4">
          <SearchBox language={language} />
          <Suspense fallback={<PickLinkSkeleton />}>
            <PickLink />
          </Suspense>
        </div>
      </aside>

      <div className="min-w-0 lg:col-span-7 xl:col-span-8">
        <ListSync coupleId={profile.couple_id} />
        <Suspense fallback={<ListSkeleton />}>
          <ListSection
            coupleId={profile.couple_id}
            me={{ id: profile.id, country: profile.country, services: profile.services }}
            locale={tmdbLocale(profile.language, profile.home_country)}
            language={profile.language}
            timeZone={profile.time_zone}
            partner={
              partner?.country
                ? {
                    id: partner.id,
                    name: partner.display_name || t.common.yourPartner,
                    watcher: { country: partner.country, services: partner.services },
                    locale: tmdbLocale(partner.language, partner.home_country),
                  }
                : null
            }
            params={params}
          />
        </Suspense>
      </div>
    </div>
  );
}

/** The next watch night, or a nudge to plan one. */
async function NextNight(props: {
  coupleId: string;
  me: { id: string; name: string; timeZone: string };
  partner: { id: string; name: string; timeZone: string };
  locales: string[];
}) {
  const [{ language, t }, [night]] = await Promise.all([getI18n(), getWatchNights(props.coupleId, props.locales, { limit: 1 })]);
  return (
    <section className="spotlight grid -rotate-1 gap-4 p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 className="display-pop text-[2rem]">{t.nights.next.heading}</h2>
        <Link
          href={night ? "/watch-nights" : "/watch-nights/new"}
          className="group inline-flex items-center gap-1 font-bold underline underline-offset-4"
        >
          {night ? t.nights.next.all : t.nights.next.planOne}
          <ArrowIcon className="size-4 transition-transform duration-200 ease-(--ease-spring) group-hover:translate-x-1" />
        </Link>
      </div>
      {night ? (
        <ul>
          <NightCard
            night={night}
            me={props.me}
            partner={props.partner}
            now={new Date()}
            language={language}
            t={t}
            className=""
            listing
          />
        </ul>
      ) : (
        <p className="text-muted">{t.nights.next.none}</p>
      )}
    </section>
  );
}

async function ListSection(props: {
  coupleId: string;
  me: Watcher & { id: string };
  locale: string;
  language: string;
  timeZone: string;
  partner: { id: string; name: string; watcher: Watcher; locale: string } | null;
  params: Awaited<PageProps<"/">["searchParams"]>;
}) {
  const { me, partner, params, language } = props;
  const { t } = await getI18n();
  const entries = await getList(props.coupleId, partner ? [props.locale, partner.locale] : [props.locale]);
  const categories = [...new Set(entries.flatMap((e) => e.categories))].sort((a, b) => a.localeCompare(b));

  const filters: Filters = {
    view: typeof params.view === "string" && params.view in VIEWS ? (params.view as View) : "next",
    category: typeof params.category === "string" && categories.includes(params.category) ? params.category : null,
    type: isMediaType(params.type) ? params.type : null,
    both: params.both === "1",
  };
  const inView = (view: View) => entries.filter((e) => (VIEWS[view].statuses as ListStatus[]).includes(e.status));
  let shown = sortEntries(
    filters.view,
    inView(filters.view).filter(
      (e) =>
        (!filters.category || e.categories.includes(filters.category)) && (!filters.type || e.media_type === filters.type),
    ),
  );

  const countries = partner ? [me.country, partner.watcher.country] : [me.country];
  // Started now, awaited by each badge, so the list renders before availability is known.
  const availability: Promise<Record<string, Availability>> =
    filters.view !== "watched" || filters.both ? getAvailability(shown, countries) : Promise.resolve({});
  if (filters.both) {
    const byTitle = await availability;
    shown = shown.filter((e) => whoCanWatch(me, partner?.watcher ?? null, byTitle[titleKey(e)] ?? {}).verdict === "both");
  }

  const isFiltered = Boolean(filters.category || filters.type || filters.both);
  const today = localDate(props.timeZone, new Date());

  return (
    <section className="grid grid-cols-[minmax(0,1fr)] gap-6">
      <h1 className="sr-only">{t.common.nav.list}</h1>

      <nav aria-label={t.list.viewsLabel} className="@container">
        <ul className="grid grid-cols-3 gap-2 pt-2 sm:flex sm:flex-wrap sm:items-center sm:gap-3 sm:pt-1">
          {(Object.keys(VIEWS) as View[]).map((view) => (
            <li key={view} className="min-w-0">
              <Link
                href={filtersHref(filters, { view })}
                aria-current={filters.view === view ? "page" : undefined}
                className="tab relative flex items-center justify-center gap-2 max-sm:px-1.5 max-sm:pb-1 max-sm:pt-2 max-sm:text-[min(1.35rem,4.6cqi)]"
              >
                <span className="truncate">{t.list.views[view]}</span>
                <span className="rounded-full border-2 border-outline bg-surface px-1.5 font-sans text-sm font-bold leading-snug text-ink max-sm:absolute max-sm:-right-1.5 max-sm:-top-2.5 max-sm:rotate-6 max-sm:text-xs">
                  {inView(view).length}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {entries.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {partner && (
            <Link href={filtersHref(filters, { both: !filters.both })} className="chip" aria-pressed={filters.both}>
              <span aria-hidden className="size-3 rounded-full border-2 border-outline bg-stamp" />
              {t.list.bothFilter}
            </Link>
          )}
          {(["movie", "tv"] as const).map((type) => (
            <Link
              key={type}
              href={filtersHref(filters, { type: filters.type === type ? null : type })}
              className="chip"
              aria-pressed={filters.type === type}
            >
              {t.common.mediaTypePlural[type]}
            </Link>
          ))}
          {categories.length > 0 && <span aria-hidden className="mx-1 w-[3px] self-stretch rounded-full bg-outline/25" />}
          {categories.map((name) => (
            <Link
              key={name}
              href={filtersHref(filters, { category: filters.category === name ? null : name })}
              className="chip"
              aria-pressed={filters.category === name}
            >
              {name}
            </Link>
          ))}
        </div>
      )}

      {shown.length === 0 ? (
        <div className="card grid justify-items-center gap-2 px-6 py-12 text-center">
          <Couches size={64} className="mb-2" />
          {entries.length === 0 ? (
            <>
              <p className="display-ink text-3xl">{t.list.empty.heading}</p>
              <p className="max-w-sm text-muted">{t.list.empty.body}</p>
            </>
          ) : isFiltered ? (
            <>
              <p className="font-semibold">{t.list.empty.noMatches}</p>
              <Link href={filtersHref(filters, { category: null, type: null, both: false })} className="btn-quiet text-sm">
                {t.list.empty.clearFilters}
              </Link>
            </>
          ) : (
            <p className="text-muted">{t.list.empty[filters.view]}</p>
          )}
        </div>
      ) : (
        <ul className="grid gap-4">
          {shown.map((entry, i) => (
            <li key={entry.id} className="tilt-row">
              <Link
                href={titleHref(entry)}
                className="card group relative grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-4 p-3 transition-shadow duration-150 hover:shadow-[8px_8px_0_var(--outline)] sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:p-4"
              >
                <Poster
                  path={entry.poster_path}
                  title={entry.title}
                  size="sm"
                  language={language}
                  morph={posterMorph(entry)}
                  className="self-start sm:w-20"
                />
                <div className="grid min-w-0 content-start gap-1 max-sm:pr-16">
                  <span className="text-xl font-bold leading-tight group-hover:underline sm:text-2xl">{entry.title}</span>
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[15px] font-medium">
                    <span>
                      {t.common.mediaType[entry.media_type]}
                      {entry.release_date && ` · ${entry.release_date.slice(0, 4)}`}
                    </span>
                    {filters.view !== "watched" && (
                      <Suspense>
                        <AvailabilityBadge
                          availability={availability}
                          titleKey={titleKey(entry)}
                          me={me}
                          partner={partner?.watcher ?? null}
                          partnerName={partner?.name ?? null}
                          language={language}
                          part="proof"
                        />
                      </Suspense>
                    )}
                    {entry.status === "watching" && (
                      <span className="max-w-full rounded-[12px] border-2 border-outline bg-accent-soft px-2 text-sm font-bold leading-snug">
                        {t.common.statuses.watching}
                        {entry.season && entry.episode
                          ? ` · ${t.list.upTo(t.common.progress(entry.season, entry.episode))}`
                          : ""}
                      </span>
                    )}
                  </span>
                  {entry.categories.length > 0 && (
                    <span className="mt-0.5 flex flex-wrap gap-1.5">
                      {entry.categories.map((name) => (
                        <span key={name} className="strand">
                          {name}
                        </span>
                      ))}
                    </span>
                  )}
                  {filters.view === "watched" && (
                    <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                      <WatchedLine entry={entry} me={me} partner={partner} language={language} />
                    </span>
                  )}
                  {entry.notes && <p className="line-clamp-2 max-w-prose text-sm">{entry.notes}</p>}
                  <p className="text-sm text-muted">
                    {addedLine(t, entry, me.id, partner, shortDate(localDate(props.timeZone, new Date(entry.created_at)), today, language))}
                  </p>
                </div>
                {/* Phones: the burst hangs off the card's corner; the dots tag follows the details. */}
                {filters.view !== "watched" && (
                  <div className="max-sm:col-start-2 max-sm:mt-2 max-sm:has-[.burst]:absolute max-sm:has-[.burst]:-top-5 max-sm:has-[.burst]:right-1 max-sm:has-[.burst]:mt-0 max-sm:has-[.burst]:origin-top-right max-sm:has-[.burst]:scale-[0.8] sm:pl-2">
                    <Suspense>
                      <AvailabilityBadge
                        availability={availability}
                        titleKey={titleKey(entry)}
                        me={me}
                        partner={partner?.watcher ?? null}
                        partnerName={partner?.name ?? null}
                        language={language}
                        onPoster
                        index={Math.min(i, 12)}
                      />
                    </Suspense>
                  </div>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function WatchedLine({
  entry,
  me,
  partner,
  language,
}: {
  entry: ListEntry;
  me: { id: string };
  partner: { id: string; name: string } | null;
  language: string;
}) {
  const t = getMessages(language);
  const mine = entry.ratings[me.id];
  const theirs = partner ? entry.ratings[partner.id] : undefined;
  return (
    <>
      {entry.watched_on && <span className="font-semibold">{formatDate(entry.watched_on, language)}</span>}
      {mine && (
        <span>
          {t.common.you} <Stars rating={mine} who={t.common.you} language={language} />
        </span>
      )}
      {partner && theirs && (
        <span>
          {partner.name} <Stars rating={theirs} who={partner.name} language={language} />
        </span>
      )}
      {!mine && !theirs && <span className="text-muted">{t.list.notRated}</span>}
    </>
  );
}
