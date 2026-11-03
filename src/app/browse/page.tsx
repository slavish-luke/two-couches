import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { CountryChip } from "@/components/country-chip";
import { FilterSelect } from "@/components/filter-select";
import { ListSync } from "@/components/list-sync";
import { PageLoading } from "@/components/page-loading";
import { TitleCard, type CardContext } from "@/components/title-card";
import {
  DECADES,
  discoverTitles,
  getGenres,
  MAX_PAGES,
  MIN_RATINGS,
  SORTS,
  trendingTitles,
  type Decade,
  type DiscoverPage,
  type DiscoverQuery,
  type MinRating,
  type Sort,
} from "@/lib/browse";
import { getI18n, localisedTitle } from "@/lib/i18n/server";
import { getListKeys } from "@/lib/list";
import { localDate } from "@/lib/list-rules";
import { countryName, isCountry } from "@/lib/places";
import { getServices, type Service } from "@/lib/services";
import { getPartner, requireProfile } from "@/lib/session";
import { getAvailability } from "@/lib/titles";
import { tmdbLocale } from "@/lib/tmdb";
import {
  isMediaType,
  titleKey,
  tmdbImage,
  whoCanWatch,
  type Availability,
  type MediaType,
  type Watcher,
} from "@/lib/watch";
import { ForYouLoading, ForYouRow } from "./for-you";

export const generateMetadata = localisedTitle("browse");

export default function BrowsePage({ searchParams }: PageProps<"/browse">) {
  return (
    <Suspense fallback={<PageLoading variant="posters" />}>
      <Browse searchParams={searchParams} />
    </Suspense>
  );
}

/** The page's filters, as read from and written to the URL. */
type Filters = {
  type: MediaType;
  /** Only titles we can both stream: on unless turned off, null without a partner. */
  both: boolean | null;
  service: number | null;
  genre: number | null;
  decade: Decade | null;
  rating: MinRating | null;
  sort: Sort;
  page: number;
};

/** The URL query for these filters, leaving out defaults. */
function filtersQuery(filters: Filters): Record<string, string> {
  const query: Record<string, string> = {};
  if (filters.type !== "movie") query.type = filters.type;
  if (filters.both === false) query.both = "0";
  if (filters.service) query.service = String(filters.service);
  if (filters.genre) query.genre = String(filters.genre);
  if (filters.decade) query.decade = filters.decade;
  if (filters.rating) query.rating = filters.rating;
  if (filters.sort !== "popular") query.sort = filters.sort;
  if (filters.page > 1) query.page = String(filters.page);
  return query;
}

/** These filters with some changed. Any change but the page itself goes back to page 1. */
function filtersHref(filters: Filters, changes: Partial<Filters>) {
  const query = new URLSearchParams(filtersQuery({ ...filters, page: 1, ...changes })).toString();
  return query ? `/browse?${query}` : "/browse";
}

function oneOf<T extends string>(values: readonly T[], value: unknown): T | null {
  return typeof value === "string" && (values as readonly string[]).includes(value) ? (value as T) : null;
}

function positiveInt(value: unknown) {
  const n = typeof value === "string" ? Number(value) : NaN;
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

/** With "we can both watch" on, each page checks this many TMDB pages, since many titles drop out. */
const BOTH_BATCH = 3;
const ROW_LENGTH = 10;

/** A service either of us pays for, and whose it is. */
type ServiceChip = Service & { whose: "both" | "me" | "partner" };

/** Shared services first, then yours, then your partner's, each in TMDB's display order. */
function serviceChips(mine: Service[], theirs: Service[], me: Watcher, them: Watcher | null): ServiceChip[] {
  const myPaid = mine.filter((s) => me.services.includes(s.provider_id));
  const theirPaid = them ? theirs.filter((s) => them.services.includes(s.provider_id)) : [];
  const myIds = new Set(myPaid.map((s) => s.provider_id));
  const theirIds = new Set(theirPaid.map((s) => s.provider_id));
  const order = { both: 0, me: 1, partner: 2 };
  return [
    ...myPaid.map((s) => ({ ...s, whose: theirIds.has(s.provider_id) ? ("both" as const) : ("me" as const) })),
    ...theirPaid.filter((s) => !myIds.has(s.provider_id)).map((s) => ({ ...s, whose: "partner" as const })),
  ].sort((a, b) => order[a.whose] - order[b.whose]);
}

async function Browse({ searchParams }: Pick<PageProps<"/browse">, "searchParams">) {
  const [profile, partner, params, { language, t }] = await Promise.all([
    requireProfile(),
    getPartner(),
    searchParams,
    getI18n(),
  ]);
  if (!isCountry(profile.country)) redirect("/settings?welcome=1");

  const locale = tmdbLocale(profile.language, profile.home_country ?? profile.country);
  const me: Watcher = { country: profile.country, services: profile.services };
  const them: Watcher | null = partner?.country ? { country: partner.country, services: partner.services } : null;
  const partnerName = partner?.display_name || t.common.yourPartner;
  const type = isMediaType(params.type) ? params.type : "movie";

  const [myServices, theirServices, genres, onList] = await Promise.all([
    getServices(profile.country),
    them && isCountry(them.country) ? getServices(them.country) : [],
    getGenres(type, locale).catch((error) => {
      console.error("Loading genres failed", error);
      return [];
    }),
    profile.couple_id ? getListKeys(profile.couple_id) : null,
  ]);
  const chips = serviceChips(myServices, theirServices, me, them);

  const filters: Filters = {
    type,
    both: them ? params.both !== "0" : null,
    service: chips.find((c) => c.provider_id === positiveInt(params.service))?.provider_id ?? null,
    genre: genres.find((g) => g.id === positiveInt(params.genre))?.id ?? null,
    decade: oneOf(DECADES, params.decade),
    rating: oneOf(MIN_RATINGS, params.rating),
    sort: oneOf(SORTS, params.sort) ?? "popular",
    page: Math.min(positiveInt(params.page) ?? 1, Math.floor(MAX_PAGES / BOTH_BATCH)),
  };
  const chip = chips.find((c) => c.provider_id === filters.service);
  const isFiltered = Boolean(filters.service || filters.genre || filters.decade || filters.rating || filters.sort !== "popular");
  const showRows = !isFiltered && filters.page === 1;

  // Look in the selected service's country (yours if you both have it), else on everything you pay for.
  const query: Omit<DiscoverQuery, "page"> = {
    type,
    region: chip?.whose === "partner" && them ? them.country : me.country,
    providers: chip ? [chip.provider_id] : me.services,
    genre: filters.genre,
    decade: filters.decade,
    minRating: filters.rating,
    sort: filters.sort,
  };
  const batch = filters.both ? BOTH_BATCH : 1;
  const tmdbPages = Array.from({ length: batch }, (_, i) => (filters.page - 1) * batch + 1 + i);
  const popularIn = (region: string): Omit<DiscoverQuery, "page"> => ({
    type,
    region,
    providers: [],
    genre: null,
    decade: null,
    minRating: null,
    sort: "popular",
  });

  const [pages, trending, popularHere, popularThere] = await Promise.all([
    Promise.allSettled(tmdbPages.map((page) => discoverTitles({ ...query, page }, locale))),
    showRows ? trendingTitles(type, locale).catch(() => []) : [],
    showRows ? discoverTitles({ ...popularIn(me.country), page: 1 }, locale).then((p) => p.results, () => []) : [],
    showRows && them && them.country !== me.country
      ? discoverTitles({ ...popularIn(them.country), page: 1 }, locale).then((p) => p.results, () => [])
      : [],
  ]);
  const rows = [
    { key: "trending", heading: t.browse.trending, note: t.browse.trendingNote, items: trending },
    { key: me.country, heading: t.browse.popularIn, country: me.country, isMe: true, items: popularHere },
    { key: them?.country ?? "", heading: t.browse.popularIn, country: them?.country, isMe: false, items: popularThere },
  ]
    .map((row) => ({ ...row, items: row.items.slice(0, ROW_LENGTH) }))
    .filter((row) => row.items.length > 0);

  const fetched = pages.flatMap((p) => (p.status === "fulfilled" ? [p.value] : []));
  const [first] = pages;
  const failed = first.status === "rejected";
  if (first.status === "rejected") console.error("Browsing TMDB failed", first.reason);
  const totalPages = Math.ceil((fetched[0]?.totalPages ?? 0) / batch);
  const checked = [...new Map(fetched.flatMap((p: DiscoverPage) => p.results).map((r) => [titleKey(r), r])).values()];

  // Started now, awaited by each badge, so the page renders before availability is known.
  const availability: Promise<Record<string, Availability>> = getAvailability(
    [...checked, ...rows.flatMap((row) => row.items)],
    them ? [me.country, them.country] : [me.country],
  );
  let shown = checked;
  if (filters.both) {
    const byTitle = await availability;
    shown = checked.filter((r) => whoCanWatch(me, them, byTitle[titleKey(r)] ?? {}).verdict === "both");
  }

  const card: CardContext = { language, availability, me, them, partnerName, onList };
  const pill = (active: boolean) =>
    `inline-flex items-center gap-1.5 rounded-full border px-3 py-1 transition ${
      active ? "border-ink bg-ink text-bg" : "border-line text-muted hover:text-ink"
    }`;
  const whose = { both: t.browse.whose.both, me: t.browse.whose.me, partner: t.browse.whose.partner(partnerName) };
  const dot = { both: "text-both", me: "text-me", partner: "text-partner" };
  const selectQuery = filtersQuery({ ...filters, page: 1 });

  let empty: ReactNode = null;
  if (failed) {
    empty = <p className="text-danger">{t.browse.failed}</p>;
  } else if (filters.both && me.services.length === 0) {
    empty = <SettingsPrompt text={t.browse.noServices} link={t.browse.goToSettings} />;
  } else if (filters.both && them && them.services.length === 0) {
    empty = <p className="text-sm text-muted">{t.browse.partnerNoServices(partnerName)}</p>;
  } else if (shown.length === 0 && filters.both && checked.length > 0 && filters.page < totalPages) {
    empty = (
      <>
        <p className="font-semibold">{t.browse.noneForBoth}</p>
        <Link href={filtersHref(filters, { page: filters.page + 1 })} className="text-sm font-semibold text-partner">
          {t.browse.lookFurther}
        </Link>
      </>
    );
  } else if (shown.length === 0) {
    empty = (
      <>
        <p className="font-semibold">{t.browse.noMatches}</p>
        {(isFiltered || filters.both) && (
          <Link
            href={filtersHref(filters, { service: null, genre: null, decade: null, rating: null, sort: "popular", both: them ? false : null })}
            className="text-sm font-semibold text-partner"
          >
            {t.browse.clearFilters}
          </Link>
        )}
      </>
    );
  }

  return (
    <div className="grid gap-8">
      <div className="grid gap-4">
        <h1 className="font-display text-3xl font-bold tracking-tight">{t.browse.heading}</h1>
        <nav aria-label={t.browse.typesLabel} className="flex gap-1 border-b border-line">
          {(["movie", "tv"] as const).map((mediaType) => (
            <Link
              key={mediaType}
              // Genre IDs differ between films and series, so switching drops the genre.
              href={filtersHref(filters, { type: mediaType, genre: null })}
              aria-current={type === mediaType ? "page" : undefined}
              className={`-mb-px border-b-2 px-3 py-2 font-semibold ${
                type === mediaType ? "border-ink text-ink" : "border-transparent text-muted hover:text-ink"
              }`}
            >
              {t.common.mediaTypePlural[mediaType]}
            </Link>
          ))}
        </nav>
      </div>
      {profile.couple_id && <ListSync coupleId={profile.couple_id} />}

      {showRows && profile.couple_id && (
        <Suspense fallback={<ForYouLoading />}>
          <ForYouRow
            coupleId={profile.couple_id}
            type={type}
            locales={partner?.country ? [locale, tmdbLocale(partner.language, partner.home_country)] : [locale]}
            countries={them ? [me.country, them.country] : [me.country]}
            today={localDate(profile.time_zone)}
            card={{ language, me, them, partnerName, onList }}
          />
        </Suspense>
      )}

      {rows.map((row) => (
        <section key={row.key} className="grid gap-3">
          <h2 className="flex flex-wrap items-center gap-2 font-display text-lg font-semibold">
            {row.heading}
            {row.note && <span className="font-sans text-sm font-normal text-muted">{row.note}</span>}
            {row.country && (
              <CountryChip code={row.country} name={countryName(row.country, language)} isMe={row.isMe} />
            )}
          </h2>
          <ul className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2">
            {row.items.map((r) => (
              <TitleCard key={titleKey(r)} result={r} context={card} className="w-32 shrink-0 snap-start" />
            ))}
          </ul>
        </section>
      ))}

      <section className="grid gap-4">
        {rows.length > 0 && (
          <h2 className="font-display text-lg font-semibold">{t.browse.streamingNow}</h2>
        )}
        <div className="flex flex-wrap gap-2 text-sm font-semibold">
          {filters.both !== null && (
            <Link href={filtersHref(filters, { both: !filters.both })} className={pill(filters.both)} aria-pressed={filters.both}>
              <span aria-hidden className={filters.both ? "" : "text-both"}>
                ●
              </span>
              {t.browse.bothToggle}
            </Link>
          )}
          {chips.map((s) => (
            <Link
              key={s.provider_id}
              href={filtersHref(filters, { service: filters.service === s.provider_id ? null : s.provider_id })}
              className={pill(filters.service === s.provider_id)}
              aria-pressed={filters.service === s.provider_id}
              title={whose[s.whose]}
            >
              {s.logo_path ? (
                <Image src={tmdbImage(s.logo_path, "w92")} alt="" width={18} height={18} unoptimized className="rounded" />
              ) : (
                <span aria-hidden className={dot[s.whose]}>
                  ●
                </span>
              )}
              {s.name}
              <span className="sr-only">({whose[s.whose]})</span>
              {s.logo_path && (
                <span aria-hidden className={`text-[0.6rem] ${filters.service === s.provider_id ? "" : dot[s.whose]}`}>
                  ●
                </span>
              )}
            </Link>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <FilterSelect
            path="/browse"
            query={selectQuery}
            name="genre"
            label={t.browse.genre}
            value={filters.genre ? String(filters.genre) : ""}
            options={[{ value: "", label: t.browse.anyGenre }, ...genres.map((g) => ({ value: String(g.id), label: g.name }))]}
          />
          <FilterSelect
            path="/browse"
            query={selectQuery}
            name="decade"
            label={t.browse.decade}
            value={filters.decade ?? ""}
            options={[{ value: "", label: t.browse.anyDecade }, ...DECADES.map((d) => ({ value: d, label: t.browse.decades[d] }))]}
          />
          <FilterSelect
            path="/browse"
            query={selectQuery}
            name="rating"
            label={t.browse.rating}
            value={filters.rating ?? ""}
            options={[
              { value: "", label: t.browse.anyRating },
              ...MIN_RATINGS.map((r) => ({ value: r, label: t.browse.minRating(r) })),
            ]}
          />
          <FilterSelect
            path="/browse"
            query={selectQuery}
            name="sort"
            label={t.browse.sort}
            value={filters.sort === "popular" ? "" : filters.sort}
            options={SORTS.map((s) => ({ value: s === "popular" ? "" : s, label: t.browse.sorts[s] }))}
          />
        </div>

        <p className="text-sm text-muted">
          {filters.both
            ? t.browse.scope.both
            : chip || me.services.length > 0
              ? t.browse.scope.mine
              : t.browse.scope.everything}
          {filters.both && !empty && ` ${t.browse.bothChecked(shown.length, checked.length)}`}
        </p>

        {empty ? (
          <div className="card grid justify-items-center gap-1 py-12 text-center">{empty}</div>
        ) : (
          <ul className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-4">
            {shown.map((r) => (
              <TitleCard key={titleKey(r)} result={r} context={card} />
            ))}
          </ul>
        )}

        {!failed && totalPages > 1 && (
          <nav aria-label={t.browse.pagesLabel} className="flex items-center justify-between gap-3 text-sm font-semibold">
            {filters.page > 1 ? (
              <Link href={filtersHref(filters, { page: filters.page - 1 })} className="btn-quiet">
                {t.browse.previous}
              </Link>
            ) : (
              <span />
            )}
            <span className="text-muted">{t.browse.page(filters.page)}</span>
            {filters.page < totalPages ? (
              <Link href={filtersHref(filters, { page: filters.page + 1 })} className="btn-quiet">
                {t.browse.more}
              </Link>
            ) : (
              <span />
            )}
          </nav>
        )}
      </section>
    </div>
  );
}

function SettingsPrompt({ text, link }: { text: string; link: string }) {
  return (
    <>
      <p className="text-sm text-muted">{text}</p>
      <Link href="/settings" className="text-sm font-semibold text-partner">
        {link}
      </Link>
    </>
  );
}
