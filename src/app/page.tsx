import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AvailabilityBadge } from "@/components/availability-badge";
import { CountryChip } from "@/components/country-chip";
import { ListSync } from "@/components/list-sync";
import { PageLoading } from "@/components/page-loading";
import { Poster } from "@/components/poster";
import { SearchBox } from "@/components/search-box";
import { Stars } from "@/components/stars";
import { getList, type ListEntry } from "@/lib/list";
import { getWatchNights } from "@/lib/nights";
import { getMessages, type Messages } from "@/lib/i18n";
import { getI18n } from "@/lib/i18n/server";
import { formatDate, localDate, type ListStatus } from "@/lib/list-rules";
import { countryName, formatLocalTime } from "@/lib/places";
import { getPartner, requireProfile } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { getAvailability } from "@/lib/titles";
import { tmdbLocale } from "@/lib/tmdb";
import { isMediaType, titleHref, titleKey, whoCanWatch, type Availability, type MediaType, type Watcher } from "@/lib/watch";
import { PickLink } from "./pick/pick-link";
import { VisitChip } from "./settings/visit-chip";
import { NightCard } from "./watch-nights/night-card";

export default function HomePage({ searchParams }: PageProps<"/">) {
  return (
    <Suspense fallback={<PageLoading />}>
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

/** "Added by you on …", "Added by {partner} on …", or just "Added on …" for anyone else. */
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

  return (
    <div className="grid gap-8">
      <div className="grid gap-3 sm:grid-cols-2">
        {[members?.find((m) => m.id === profile.id), members?.find((m) => m.id !== profile.id)].map((person, i) =>
          person ? (
            <div key={person.id} className="card grid gap-1">
              <div className="flex items-center gap-2">
                <span className="font-display text-lg font-semibold">{person.display_name || t.list.people.noName}</span>
                {person.country && (
                  <CountryChip
                    code={person.country}
                    name={countryName(person.country, profile.language)}
                    isMe={person.id === profile.id}
                  />
                )}
                <VisitChip person={person} language={profile.language} now={now} />
              </div>
              <span className="text-sm text-muted">
                {person.country
                  ? t.list.people.localTime(formatLocalTime(now, person.time_zone, profile.language))
                  : t.list.people.settingUp}
              </span>
            </div>
          ) : (
            <Link key={i} href="/couple" className="card grid gap-1 border-dashed hover:border-partner">
              <span className="font-display text-lg font-semibold">{t.list.people.waiting}</span>
              <span className="text-sm text-muted">{t.list.people.shareInvite}</span>
            </Link>
          ),
        )}
      </div>

      {partner && (
        <Suspense>
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
        </Suspense>
      )}

      <SearchBox language={language} />
      <Suspense><PickLink /></Suspense>

      <ListSync coupleId={profile.couple_id} />
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
    <section className="grid gap-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-lg font-semibold">{t.nights.next.heading}</h2>
        <Link href={night ? "/watch-nights" : "/watch-nights/new"} className="text-sm font-semibold text-partner">
          {night ? t.nights.next.all : t.nights.next.planOne}
        </Link>
      </div>
      {night ? (
        <ul>
          <NightCard night={night} me={props.me} partner={props.partner} now={new Date()} language={language} t={t} />
        </ul>
      ) : (
        <p className="card py-3 text-sm text-muted">{t.nights.next.none}</p>
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

  const chip = (active: boolean) =>
    `rounded-full border px-3 py-1 transition ${active ? "border-ink bg-ink text-bg" : "border-line text-muted hover:text-ink"}`;
  const isFiltered = Boolean(filters.category || filters.type || filters.both);

  return (
    <section className="grid gap-4">
      <h1 className="font-display text-3xl font-bold tracking-tight">{t.common.nav.list}</h1>

      <nav aria-label={t.list.viewsLabel} className="flex gap-1 border-b border-line">
        {(Object.keys(VIEWS) as View[]).map((view) => (
          <Link
            key={view}
            href={filtersHref(filters, { view })}
            aria-current={filters.view === view ? "page" : undefined}
            className={`-mb-px border-b-2 px-3 py-2 font-semibold ${
              filters.view === view ? "border-ink text-ink" : "border-transparent text-muted hover:text-ink"
            }`}
          >
            {t.list.views[view]} <span className="font-normal text-muted">{inView(view).length}</span>
          </Link>
        ))}
      </nav>

      {entries.length > 0 && (
        <div className="flex flex-wrap gap-2 text-sm font-semibold">
          {partner && (
            <Link href={filtersHref(filters, { both: !filters.both })} className={chip(filters.both)} aria-pressed={filters.both}>
              <span aria-hidden className={filters.both ? "" : "text-both"}>
                ●{" "}
              </span>
              {t.list.bothFilter}
            </Link>
          )}
          <Link href={filtersHref(filters, { type: filters.type === "movie" ? null : "movie" })} className={chip(filters.type === "movie")}>
            {t.common.mediaTypePlural.movie}
          </Link>
          <Link href={filtersHref(filters, { type: filters.type === "tv" ? null : "tv" })} className={chip(filters.type === "tv")}>
            {t.common.mediaTypePlural.tv}
          </Link>
          {categories.map((name) => (
            <Link
              key={name}
              href={filtersHref(filters, { category: filters.category === name ? null : name })}
              className={chip(filters.category === name)}
            >
              {name}
            </Link>
          ))}
        </div>
      )}

      {shown.length === 0 ? (
        <div className="card grid justify-items-center gap-1 py-12 text-center">
          {entries.length === 0 ? (
            <>
              <p className="font-semibold">{t.list.empty.heading}</p>
              <p className="text-sm text-muted">{t.list.empty.body}</p>
            </>
          ) : isFiltered ? (
            <>
              <p className="font-semibold">{t.list.empty.noMatches}</p>
              <Link href={filtersHref(filters, { category: null, type: null, both: false })} className="text-sm font-semibold text-partner">
                {t.list.empty.clearFilters}
              </Link>
            </>
          ) : (
            <p className="text-sm text-muted">{t.list.empty[filters.view]}</p>
          )}
        </div>
      ) : (
        <ul className="grid gap-3">
          {shown.map((entry) => (
            <li key={entry.id}>
              <Link href={titleHref(entry)} className="card flex gap-4 p-3 transition hover:border-muted">
                <Poster path={entry.poster_path} title={entry.title} size="sm" language={language} />
                <div className="grid min-w-0 content-start gap-1.5">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <span className="font-display text-lg font-semibold leading-snug">{entry.title}</span>
                    <span className="text-sm text-muted">
                      {entry.release_date?.slice(0, 4)} {t.common.mediaType[entry.media_type]}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    {entry.status === "watching" && (
                      <span className="font-semibold">
                        {t.common.statuses.watching}
                        {entry.season && entry.episode
                          ? ` · ${t.list.upTo(t.common.progress(entry.season, entry.episode))}`
                          : ""}
                      </span>
                    )}
                    {filters.view === "watched" && (
                      <WatchedLine entry={entry} me={me} partner={partner} language={language} />
                    )}
                    {filters.view !== "watched" && (
                      <Suspense>
                        <AvailabilityBadge
                          availability={availability}
                          titleKey={titleKey(entry)}
                          me={me}
                          partner={partner?.watcher ?? null}
                          partnerName={partner?.name ?? null}
                          language={language}
                        />
                      </Suspense>
                    )}
                    {entry.categories.map((name) => (
                      <span key={name} className="rounded-full bg-partner-soft px-2 py-0.5 text-xs text-partner">
                        {name}
                      </span>
                    ))}
                  </div>

                  {entry.notes && <p className="line-clamp-2 text-sm">{entry.notes}</p>}
                  <p className="text-xs text-muted">
                    {addedLine(t, entry, me.id, partner, formatDate(localDate(props.timeZone, new Date(entry.created_at)), language))}
                  </p>
                </div>
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
