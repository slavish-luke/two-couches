import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AvailabilityBadge } from "@/components/availability-badge";
import { CountryChip } from "@/components/country-chip";
import { ListSync } from "@/components/list-sync";
import { Poster } from "@/components/poster";
import { SearchBox } from "@/components/search-box";
import { Stars } from "@/components/stars";
import { getList, type ListEntry } from "@/lib/list";
import { formatDate, formatProgress, localDate, type ListStatus } from "@/lib/list-rules";
import { countryName, formatLocalTime } from "@/lib/places";
import { getPartner, requireProfile } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { getAvailability } from "@/lib/titles";
import { tmdbLocale } from "@/lib/tmdb";
import { isMediaType, titleHref, titleKey, whoCanWatch, type Availability, type MediaType, type Watcher } from "@/lib/watch";

export default function HomePage({ searchParams }: PageProps<"/">) {
  return (
    <Suspense fallback={<p className="text-muted">Loading…</p>}>
      <OurList searchParams={searchParams} />
    </Suspense>
  );
}

const VIEWS = {
  next: { label: "Up next", statuses: ["watching", "want"] },
  watched: { label: "Watched", statuses: ["watched"] },
  dropped: { label: "Dropped", statuses: ["dropped"] },
} satisfies Record<string, { label: string; statuses: ListStatus[] }>;

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

async function OurList({ searchParams }: Pick<PageProps<"/">, "searchParams">) {
  const profile = await requireProfile();
  if (!profile.country) redirect("/settings?welcome=1");
  if (!profile.couple_id) redirect("/couple");

  const supabase = await createClient();
  const [{ data: members }, partner, params] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, display_name, country, time_zone")
      .eq("couple_id", profile.couple_id)
      .order("created_at"),
    getPartner(),
    searchParams,
  ]);
  const now = new Date();

  return (
    <div className="grid gap-8">
      <div className="grid gap-3 sm:grid-cols-2">
        {[members?.find((m) => m.id === profile.id), members?.find((m) => m.id !== profile.id)].map((person, i) =>
          person ? (
            <div key={person.id} className="card grid gap-1">
              <div className="flex items-center gap-2">
                <span className="font-display text-lg font-semibold">{person.display_name || "No name yet"}</span>
                {person.country && (
                  <CountryChip
                    code={person.country}
                    name={countryName(person.country, profile.language)}
                    isMe={person.id === profile.id}
                  />
                )}
              </div>
              <span className="text-sm text-muted">
                {person.country
                  ? `${formatLocalTime(now, person.time_zone, profile.language)} local time`
                  : "Still setting up"}
              </span>
            </div>
          ) : (
            <Link key={i} href="/couple" className="card grid gap-1 border-dashed hover:border-partner">
              <span className="font-display text-lg font-semibold">Waiting for your partner</span>
              <span className="text-sm text-muted">Share your invite code →</span>
            </Link>
          ),
        )}
      </div>

      <SearchBox />

      <ListSync coupleId={profile.couple_id} />
      <ListSection
        coupleId={profile.couple_id}
        me={{ id: profile.id, country: profile.country, services: profile.services }}
        locale={tmdbLocale(profile.language, profile.country)}
        language={profile.language}
        timeZone={profile.time_zone}
        partner={
          partner?.country
            ? {
                id: partner.id,
                name: partner.display_name || "Your partner",
                watcher: { country: partner.country, services: partner.services },
                locale: tmdbLocale(partner.language, partner.country),
              }
            : null
        }
        params={params}
      />
    </div>
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
      <h1 className="font-display text-3xl font-bold tracking-tight">Our list</h1>

      <nav aria-label="List views" className="flex gap-1 border-b border-line">
        {(Object.keys(VIEWS) as View[]).map((view) => (
          <Link
            key={view}
            href={filtersHref(filters, { view })}
            aria-current={filters.view === view ? "page" : undefined}
            className={`-mb-px border-b-2 px-3 py-2 font-semibold ${
              filters.view === view ? "border-ink text-ink" : "border-transparent text-muted hover:text-ink"
            }`}
          >
            {VIEWS[view].label} <span className="font-normal text-muted">{inView(view).length}</span>
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
              We can both watch
            </Link>
          )}
          <Link href={filtersHref(filters, { type: filters.type === "movie" ? null : "movie" })} className={chip(filters.type === "movie")}>
            Films
          </Link>
          <Link href={filtersHref(filters, { type: filters.type === "tv" ? null : "tv" })} className={chip(filters.type === "tv")}>
            Series
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
              <p className="font-semibold">Nothing here yet</p>
              <p className="text-sm text-muted">Search for a film or series and add it to your list.</p>
            </>
          ) : isFiltered ? (
            <>
              <p className="font-semibold">Nothing matches these filters</p>
              <Link href={filtersHref(filters, { category: null, type: null, both: false })} className="text-sm font-semibold text-partner">
                Clear filters
              </Link>
            </>
          ) : (
            <p className="text-sm text-muted">
              {
                {
                  next: "Everything's watched or dropped. Search for something new.",
                  watched: "Nothing watched yet. Mark a title watched from its page.",
                  dropped: "Nothing dropped.",
                }[filters.view]
              }
            </p>
          )}
        </div>
      ) : (
        <ul className="grid gap-3">
          {shown.map((entry) => (
            <li key={entry.id}>
              <Link href={titleHref(entry)} className="card flex gap-4 p-3 transition hover:border-muted">
                <Poster path={entry.poster_path} title={entry.title} size="sm" />
                <div className="grid min-w-0 content-start gap-1.5">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <span className="font-display text-lg font-semibold leading-snug">{entry.title}</span>
                    <span className="text-sm text-muted">
                      {entry.release_date?.slice(0, 4)} {entry.media_type === "movie" ? "Film" : "Series"}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    {entry.status === "watching" && (
                      <span className="font-semibold">
                        Watching
                        {entry.season && entry.episode
                          ? ` · up to ${formatProgress({ season: entry.season, episode: entry.episode })}`
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
                    Added{" "}
                    {entry.added_by === me.id ? "by you " : entry.added_by === partner?.id ? `by ${partner.name} ` : ""}
                    on {formatDate(localDate(props.timeZone, new Date(entry.created_at)), language)}
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
  const mine = entry.ratings[me.id];
  const theirs = partner ? entry.ratings[partner.id] : undefined;
  return (
    <>
      {entry.watched_on && <span className="font-semibold">{formatDate(entry.watched_on, language)}</span>}
      {mine && (
        <span>
          You <Stars rating={mine} who="You" />
        </span>
      )}
      {partner && theirs && (
        <span>
          {partner.name} <Stars rating={theirs} who={partner.name} />
        </span>
      )}
      {!mine && !theirs && <span className="text-muted">Not rated</span>}
    </>
  );
}
