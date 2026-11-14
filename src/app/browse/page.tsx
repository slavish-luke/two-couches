import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { Couches } from "@/components/couch";
import { CountryChip } from "@/components/country-chip";
import { DealIn } from "@/components/deal-in";
import { ArrowIcon, BackIcon, GlobeIcon } from "@/components/icons";
import { FilterSelect } from "@/components/filter-select";
import { ListSync } from "@/components/list-sync";
import { TitleCard, type CardContext } from "@/components/title-card";
import {
  batchPages,
  BOTH_BATCH,
  DECADES,
  discoverTitles,
  getGenres,
  MAX_PAGES,
  MIN_RATINGS,
  popularIn,
  SORTS,
  trendingTitles,
  type Decade,
  type DiscoverPage,
  type DiscoverQuery,
  type MinRating,
  type Sort,
} from "@/lib/browse";
import type { Messages } from "@/lib/i18n";
import { getI18n, localisedTitle } from "@/lib/i18n/server";
import { getListKeys } from "@/lib/list";
import { localDate } from "@/lib/list-rules";
import { countryName, isCountry } from "@/lib/places";
import { getServices, type Service } from "@/lib/services";
import { getPartner, requireProfile } from "@/lib/session";
import { getAvailability } from "@/lib/titles";
import { ourCountries } from "@/lib/time-rules";
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
import { ForYouRow } from "./for-you";
import { BrowseResultsSkeleton, BrowseSkeleton, ForYouSkeleton } from "./skeleton";

export const generateMetadata = localisedTitle("browse");

export default function BrowsePage({ searchParams }: PageProps<"/browse">) {
  return (
    <Suspense fallback={<BrowseSkeleton />}>
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
  /** Sprint 22: only titles made in one of your home countries. */
  made: boolean;
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
  if (filters.made) query.made = "1";
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

const ROW_LENGTH = 6;

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
  // Both of your home countries (a visit doesn't change where you're from).
  const homes = ourCountries([profile.home_country, partner?.home_country]);

  const filters: Filters = {
    type,
    both: them ? params.both !== "0" : null,
    service: chips.find((c) => c.provider_id === positiveInt(params.service))?.provider_id ?? null,
    genre: genres.find((g) => g.id === positiveInt(params.genre))?.id ?? null,
    decade: oneOf(DECADES, params.decade),
    rating: oneOf(MIN_RATINGS, params.rating),
    sort: oneOf(SORTS, params.sort) ?? "popular",
    made: params.made === "1" && homes.length > 0,
    page: Math.min(positiveInt(params.page) ?? 1, Math.floor(MAX_PAGES / BOTH_BATCH)),
  };
  const chip = chips.find((c) => c.provider_id === filters.service);
  const isFiltered = Boolean(
    filters.service || filters.genre || filters.decade || filters.rating || filters.sort !== "popular" || filters.made,
  );
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
    ...(filters.made && { origins: homes }),
  };
  // warmCaches() (src/lib/warm.ts) asks for the same as an unfiltered first page; keep the two in step.
  const tmdbPages = batchPages(filters.page, filters.both);
  const batch = tmdbPages.length;

  const [pages, trending, popularHere, popularThere] = await Promise.all([
    Promise.allSettled(tmdbPages.map((page) => discoverTitles({ ...query, page }, locale))),
    showRows ? trendingTitles(type, locale).catch(() => []) : [],
    showRows ? discoverTitles({ ...popularIn(type, me.country), page: 1 }, locale).then((p) => p.results, () => []) : [],
    showRows && them && them.country !== me.country
      ? discoverTitles({ ...popularIn(type, them.country), page: 1 }, locale).then((p) => p.results, () => [])
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
  const card: CardContext = { language, availability, me, them, partnerName, onList };
  const whose = { both: t.browse.whose.both, me: t.browse.whose.me, partner: t.browse.whose.partner(partnerName) };
  const dot = { both: "bg-stamp", me: "bg-me", partner: "bg-partner" };
  const selectQuery = filtersQuery({ ...filters, page: 1 });
  const homeNames = homes.map((code) => countryName(code, language)).join(t.time.made.or);

  return (
    <div data-wide className="grid gap-8">
      <h1 className="sr-only">{t.browse.heading}</h1>
      {/* Sprint 26: Films / Series deal the new cards in (the grid has its own, as it can stream in later). */}
      <DealIn scope="browse" tab={type} />
      <nav aria-label={t.browse.typesLabel}>
        <ul className="-mx-1 flex items-center gap-3 overflow-x-auto px-1 pb-2 pt-1 [scrollbar-width:none]">
          {(["movie", "tv"] as const).map((mediaType) => (
            <li key={mediaType} className="shrink-0">
              <Link
                // Genre IDs differ between films and series, so switching drops the genre.
                href={filtersHref(filters, { type: mediaType, genre: null })}
                aria-current={type === mediaType ? "page" : undefined}
                data-deal-tab="browse"
                data-deal-to={mediaType}
                className="tab block px-5 pb-2 pt-3.5 text-[2rem] sm:text-[2.6rem]"
              >
                {t.common.mediaTypePlural[mediaType]}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      {profile.couple_id && <ListSync coupleId={profile.couple_id} />}

      {/* The catalogue leads; For you and the strands run down a rail beside it on wide screens and come first on phones. */}
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_24rem] lg:grid-rows-[auto_1fr] lg:gap-x-10 xl:grid-cols-[minmax(0,1fr)_27rem]">
        {showRows && profile.couple_id && (
          <div className="lg:col-start-2 lg:row-start-1">
            <Suspense fallback={<ForYouSkeleton />}>
              <ForYouRow
                coupleId={profile.couple_id}
                type={type}
                locales={partner?.country ? [locale, tmdbLocale(partner.language, partner.home_country)] : [locale]}
                countries={them ? [me.country, them.country] : [me.country]}
                today={localDate(profile.time_zone)}
                card={{ language, me, them, partnerName, onList }}
              />
            </Suspense>
          </div>
        )}
        <section className="grid content-start gap-5 lg:col-start-1 lg:row-span-2 lg:row-start-1">
          {rows.length > 0 && <h2 className="display text-[clamp(2rem,4vw,2.8rem)]">{t.browse.streamingNow}</h2>}
          <div className="flex flex-wrap gap-2">
            {filters.both !== null && (
              <Link href={filtersHref(filters, { both: !filters.both })} className="chip" aria-current={filters.both ? "true" : undefined}>
                <span aria-hidden className="size-3 rounded-full border-2 border-outline bg-stamp" />
                {t.browse.bothToggle}
              </Link>
            )}
            {homes.length > 0 && (
              <Link
                href={filtersHref(filters, { made: !filters.made })}
                className="chip"
                aria-current={filters.made ? "true" : undefined}
                title={t.time.made.names(homeNames)}
              >
                <GlobeIcon className="size-4" />
                {homes.length > 1 ? t.time.made.ours : t.time.made.one(homeNames)}
                {homes.length > 1 && <span className="sr-only"> ({t.time.made.names(homeNames)})</span>}
              </Link>
            )}
            {chips.length > 0 && filters.both !== null && (
              <span aria-hidden className="mx-1 w-[3px] self-stretch rounded-full bg-outline/25" />
            )}
            {chips.map((s) => (
              <Link
                key={s.provider_id}
                href={filtersHref(filters, { service: filters.service === s.provider_id ? null : s.provider_id })}
                className="chip py-0.5 pl-1"
                aria-current={filters.service === s.provider_id ? "true" : undefined}
                title={whose[s.whose]}
              >
                {s.logo_path ? (
                  <Image
                    src={tmdbImage(s.logo_path, "w92")}
                    alt=""
                    width={24}
                    height={24}
                    unoptimized
                    className="size-6 rounded-full border-2 border-outline"
                  />
                ) : (
                  <span className="w-1" />
                )}
                {s.name}
                <span className="sr-only">({whose[s.whose]})</span>
                <span aria-hidden className={`size-3 shrink-0 rounded-full border-2 border-outline ${dot[s.whose]}`} />
              </Link>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:max-w-4xl">
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

          {/* With "We can both watch" on, the grid waits for every title's availability: the rest is already here. */}
          <Suspense fallback={<BrowseResultsSkeleton />}>
            <BrowseResults
              filters={filters}
              checked={checked}
              availability={availability}
              card={card}
              failed={failed}
              totalPages={totalPages}
              isFiltered={isFiltered}
              serviceChosen={Boolean(chip)}
              t={t}
            />
          </Suspense>
        </section>
        {rows.length > 0 && (
          <div className="grid content-start gap-8 lg:col-start-2 lg:row-start-2">
            {rows.map((row) => (
              <section key={row.key} className="card grid gap-4 pb-6">
                <h2 className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                  <span className="display-ink text-2xl">{row.heading}</span>
                  {row.country && (
                    <CountryChip code={row.country} name={countryName(row.country, language)} isMe={row.isMe} />
                  )}
                  {row.note && <span className="text-sm font-medium text-muted">{row.note}</span>}
                </h2>
                <ul className="grid grid-cols-3 gap-x-3 gap-y-6 pt-1 sm:grid-cols-6 lg:grid-cols-3">
                  {row.items.map((r, i) => (
                    <TitleCard key={titleKey(r)} result={r} context={card} index={i} className="text-sm" />
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/** The scope line, then the grid (or why it's empty) and the pages. Waits for availability when "both" is on. */
async function BrowseResults(props: {
  filters: Filters;
  checked: DiscoverPage["results"];
  availability: Promise<Record<string, Availability>>;
  card: CardContext;
  failed: boolean;
  totalPages: number;
  isFiltered: boolean;
  /** Whether a service chip is selected. */
  serviceChosen: boolean;
  t: Messages;
}) {
  const { filters, checked, card, failed, totalPages, isFiltered, t } = props;
  const { me, them, partnerName } = card;
  let shown = checked;
  if (filters.both) {
    const byTitle = await props.availability;
    shown = checked.filter((r) => whoCanWatch(me, them, byTitle[titleKey(r)] ?? {}).verdict === "both");
  }

  let empty: ReactNode = null;
  if (failed) {
    empty = (
      <p role="alert" className="font-semibold text-danger">
        {t.browse.failed}
      </p>
    );
  } else if (filters.both && me.services.length === 0) {
    empty = <SettingsPrompt text={t.browse.noServices} link={t.browse.goToSettings} />;
  } else if (filters.both && them && them.services.length === 0) {
    empty = <p className="max-w-md font-medium text-muted">{t.browse.partnerNoServices(partnerName)}</p>;
  } else if (shown.length === 0 && filters.both && checked.length > 0 && filters.page < totalPages) {
    empty = (
      <>
        <p className="display-ink text-2xl">{t.browse.noneForBoth}</p>
        <Link href={filtersHref(filters, { page: filters.page + 1 })} className="btn mt-2">
          {t.browse.lookFurther} <ArrowIcon />
        </Link>
      </>
    );
  } else if (shown.length === 0) {
    empty = (
      <>
        <p className="display-ink text-2xl">{t.browse.noMatches}</p>
        {(isFiltered || filters.both) && (
          <Link
            href={filtersHref(filters, {
              service: null,
              genre: null,
              decade: null,
              rating: null,
              sort: "popular",
              made: false,
              both: them ? false : null,
            })}
            className="btn-quiet mt-2 text-sm"
          >
            {t.browse.clearFilters}
          </Link>
        )}
      </>
    );
  }

  return (
    <>
      <DealIn scope="browse" tab={filters.type} />
      <p className="max-w-[65ch] text-sm font-medium text-muted">
        {filters.both
          ? t.browse.scope.both
          : props.serviceChosen || me.services.length > 0
            ? t.browse.scope.mine
            : t.browse.scope.everything}
        {filters.both && !empty && ` ${t.browse.bothChecked(shown.length, checked.length)}`}
      </p>

      {empty ? (
        <div className="card grid justify-items-center gap-2 px-6 py-12 text-center">
          <Couches size={56} className="mb-2" />
          {empty}
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-x-5 gap-y-8 pt-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
          {shown.map((r, i) => (
            <TitleCard key={titleKey(r)} result={r} context={card} index={i} eager={i < 2} />
          ))}
        </ul>
      )}

      {!failed && totalPages > 1 && (
        <nav aria-label={t.browse.pagesLabel} className="mt-2 flex items-center justify-between gap-3">
          {filters.page > 1 ? (
            <Link href={filtersHref(filters, { page: filters.page - 1 })} className="btn-quiet">
              <BackIcon /> {t.browse.previous}
            </Link>
          ) : (
            <span />
          )}
          <span className="rounded-full border-[2.5px] border-outline bg-surface px-3 py-0.5 text-sm font-bold">
            {t.browse.page(filters.page)}
          </span>
          {filters.page < totalPages ? (
            <Link href={filtersHref(filters, { page: filters.page + 1 })} className="btn">
              {t.browse.more} <ArrowIcon />
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </>
  );
}

function SettingsPrompt({ text, link }: { text: string; link: string }) {
  return (
    <>
      <p className="max-w-md font-medium text-muted">{text}</p>
      <Link href="/settings" className="btn-quiet mt-2 text-sm">
        {link} <ArrowIcon />
      </Link>
    </>
  );
}
