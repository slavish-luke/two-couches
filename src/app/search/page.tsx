import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Couches } from "@/components/couch";
import { ListSync } from "@/components/list-sync";
import { SearchBox } from "@/components/search-box";
import { TitleCard, type CardContext } from "@/components/title-card";
import type { Messages } from "@/lib/i18n";
import { getI18n, localisedTitle } from "@/lib/i18n/server";
import { getListKeys } from "@/lib/list";
import { getPartner, requireProfile } from "@/lib/session";
import { getAvailability, searchTitles, type SearchResult } from "@/lib/titles";
import { tmdbLocale } from "@/lib/tmdb";
import { titleKey, type Watcher } from "@/lib/watch";
import { SearchResultsSkeleton, SearchSkeleton } from "./skeleton";
import { SendTitle } from "@/app/list/send-title";
import { getOpenSends } from "@/lib/shelf";

export const generateMetadata = localisedTitle("search");

export default function SearchPage({ searchParams }: PageProps<"/search">) {
  return (
    <Suspense fallback={<SearchSkeleton />}>
      <Search searchParams={searchParams} />
    </Suspense>
  );
}

/** The heading and search box come first; the results stream in under them. */
async function Search({ searchParams }: Pick<PageProps<"/search">, "searchParams">) {
  const [profile, { q }, { language, t }] = await Promise.all([requireProfile(), searchParams, getI18n()]);
  if (!profile.country) redirect("/settings?welcome=1");
  const query = (typeof q === "string" ? q : "").trim().slice(0, 100);

  return (
    <div className="grid gap-6">
      <h1 className="display -rotate-1 text-[clamp(2.4rem,5vw,3.6rem)]">{t.list.search.heading}</h1>
      <SearchBox query={query} autoFocus={!query} language={language} />
      {profile.couple_id && <ListSync coupleId={profile.couple_id} />}
      <Suspense fallback={<SearchResultsSkeleton />}>
        <Results
          query={query}
          myId={profile.id}
          locale={tmdbLocale(profile.language, profile.home_country)}
          coupleId={profile.couple_id}
          me={{ country: profile.country, services: profile.services }}
          language={language}
          t={t}
        />
      </Suspense>
    </div>
  );
}

async function Results(props: {
  query: string;
  myId: string;
  locale: string;
  coupleId: string | null;
  me: Watcher;
  language: string;
  t: Messages;
}) {
  const { query, me, language, t } = props;
  const partner = await getPartner();
  let results: SearchResult[] = [];
  let failed = false;
  if (query) {
    try {
      results = await searchTitles(query, props.locale);
    } catch (error) {
      console.error("Search failed", error);
      failed = true;
    }
  }

  const [onList, sent] = props.coupleId && results.length > 0
    ? await Promise.all([getListKeys(props.coupleId), partner ? getOpenSends(props.coupleId, props.myId) : null])
    : [null, null];
  const them: Watcher | null = partner?.country ? { country: partner.country, services: partner.services } : null;
  // Started now, awaited by each badge, so results render before availability is known.
  const availability = getAvailability(results, them ? [me.country, them.country] : [me.country]);

  const card: CardContext = {
    language,
    availability,
    me,
    them,
    partnerName: partner?.display_name || t.common.yourPartner,
    onList,
  };

  if (failed) {
    return (
      <div className="card grid justify-items-center gap-3 px-6 py-10 text-center">
        <Couches size={56} />
        <p role="alert" className="font-semibold text-danger">
          {t.list.search.failed}
        </p>
      </div>
    );
  }
  if (!query || results.length === 0) {
    return (
      <div className="card grid justify-items-center gap-2 px-6 py-10 text-center">
        <Couches size={56} className="mb-2" />
        {query ? (
          <>
            <p className="display-ink max-w-md text-2xl">{t.list.search.noResults(query)}</p>
            <p className="max-w-sm font-medium text-muted">{t.list.search.noResultsHint}</p>
          </>
        ) : (
          <p className="max-w-sm font-medium text-muted">{t.list.search.prompt}</p>
        )}
      </div>
    );
  }
  return (
    <ul className="grid grid-cols-2 gap-x-5 gap-y-8 pt-3 sm:grid-cols-3 md:grid-cols-4">
      {results.map((r, i) => (
        <TitleCard
          key={titleKey(r)}
          result={r}
          context={card}
          index={i}
          details={
            <span className="text-sm font-medium text-muted">
              {[r.release_date?.slice(0, 4), t.common.mediaType[r.media_type]].filter(Boolean).join(" · ")}
            </span>
          }
        >
          {/* Sprint 21: send it to your partner with a note. */}
          {sent && (
            <SendTitle
              titleRef={{ media_type: r.media_type, tmdb_id: r.tmdb_id }}
              title={r.title}
              partnerName={card.partnerName}
              language={language}
              waiting={sent.get(titleKey(r)) ?? null}
              compact
            />
          )}
        </TitleCard>
      ))}
    </ul>
  );
}
