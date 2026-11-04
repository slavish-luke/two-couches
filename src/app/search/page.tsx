import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Couches } from "@/components/couch";
import { ListSync } from "@/components/list-sync";
import { PageLoading } from "@/components/page-loading";
import { SearchBox } from "@/components/search-box";
import { TitleCard, type CardContext } from "@/components/title-card";
import { getI18n, localisedTitle } from "@/lib/i18n/server";
import { getListKeys } from "@/lib/list";
import { getPartner, requireProfile } from "@/lib/session";
import { getAvailability, searchTitles, type SearchResult } from "@/lib/titles";
import { tmdbLocale } from "@/lib/tmdb";
import { titleKey, type Watcher } from "@/lib/watch";

export const generateMetadata = localisedTitle("search");

export default function SearchPage({ searchParams }: PageProps<"/search">) {
  return (
    <Suspense fallback={<PageLoading variant="posters" />}>
      <Search searchParams={searchParams} />
    </Suspense>
  );
}

async function Search({ searchParams }: Pick<PageProps<"/search">, "searchParams">) {
  const [profile, partner, { q }, { language, t }] = await Promise.all([
    requireProfile(),
    getPartner(),
    searchParams,
    getI18n(),
  ]);
  if (!profile.country) redirect("/settings?welcome=1");
  const query = (typeof q === "string" ? q : "").trim().slice(0, 100);

  let results: SearchResult[] = [];
  let failed = false;
  if (query) {
    try {
      results = await searchTitles(query, tmdbLocale(profile.language, profile.home_country));
    } catch (error) {
      console.error("Search failed", error);
      failed = true;
    }
  }

  const onList = profile.couple_id && results.length > 0 ? await getListKeys(profile.couple_id) : null;
  const me: Watcher = { country: profile.country, services: profile.services };
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

  return (
    <div className="grid gap-6">
      <h1 className="display -rotate-1 text-[clamp(2.4rem,5vw,3.6rem)]">{t.list.search.heading}</h1>
      <SearchBox query={query} autoFocus={!query} language={language} />
      {profile.couple_id && <ListSync coupleId={profile.couple_id} />}

      {failed ? (
        <div className="card grid justify-items-center gap-3 px-6 py-10 text-center">
          <Couches size={56} />
          <p role="alert" className="font-semibold text-danger">
            {t.list.search.failed}
          </p>
        </div>
      ) : !query || results.length === 0 ? (
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
      ) : (
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
            />
          ))}
        </ul>
      )}
    </div>
  );
}
