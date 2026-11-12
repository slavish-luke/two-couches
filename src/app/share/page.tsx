import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Couches } from "@/components/couch";
import { SearchIcon } from "@/components/icons";
import { ListSync } from "@/components/list-sync";
import { TitleCard, type CardContext } from "@/components/title-card";
import type { Messages } from "@/lib/i18n";
import { getI18n, localisedTitle } from "@/lib/i18n/server";
import { getListKeys } from "@/lib/list";
import { findByImdb } from "@/lib/lookup";
import { getPartner, requireProfile } from "@/lib/session";
import { preferYear, readShared, sharedSummary, type SharedLookup } from "@/lib/share-rules";
import { getAvailability, getTitle, searchTitles, type SearchResult } from "@/lib/titles";
import { tmdbLocale } from "@/lib/tmdb";
import { titleKey, type Watcher } from "@/lib/watch";
import { ShareResultsSkeleton, ShareSkeleton } from "./skeleton";

export const generateMetadata = localisedTitle("share");

/** Most results shown for a share: it's usually one title, so the first few are plenty. */
const MAX_RESULTS = 8;

/**
 * Where "Share → Two Couches" lands (the manifest's share_target, Android): the film or series found in
 * what was shared, with "+ Add" and a link to its page. Needs a session like every other page.
 */
export default function SharePage({ searchParams }: PageProps<"/share">) {
  return (
    <Suspense fallback={<ShareSkeleton />}>
      <Share searchParams={searchParams} />
    </Suspense>
  );
}

function param(value: string | string[] | undefined) {
  return typeof value === "string" ? value : null;
}

async function Share({ searchParams }: Pick<PageProps<"/share">, "searchParams">) {
  const [profile, params, { language, t }] = await Promise.all([requireProfile(), searchParams, getI18n()]);
  if (!profile.country) redirect("/settings?welcome=1");
  const shared = { title: param(params.title), text: param(params.text), url: param(params.url) };
  const lookup = readShared(shared);
  const summary = sharedSummary(shared);

  return (
    <div className="grid gap-6">
      <div className="grid gap-3">
        <h1 className="display -rotate-1 text-[clamp(2.4rem,5vw,3.6rem)]">{t.diary.share.heading}</h1>
        {summary && (
          <p className="grid max-w-[65ch] gap-0.5 font-medium">
            <span className="text-sm font-bold text-muted">{t.diary.share.shared}</span>
            <q className="[overflow-wrap:anywhere]">{summary}</q>
          </p>
        )}
      </div>
      {profile.couple_id && <ListSync coupleId={profile.couple_id} />}
      <Suspense fallback={<ShareResultsSkeleton />}>
        <Results
          lookup={lookup}
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

/** The titles a share points at, best first. */
async function lookUp(lookup: SharedLookup, locale: string): Promise<SearchResult[]> {
  if (lookup.kind === "imdb") return findByImdb(lookup.id, locale);
  if (lookup.kind === "tmdb") {
    const title = await getTitle(lookup.ref, locale);
    return title ? [{ ...lookup.ref, title: title.title, original_title: title.original_title, release_date: title.release_date, poster_path: title.poster_path, overview: title.overview }] : [];
  }
  return preferYear(await searchTitles(lookup.query, locale), lookup.year);
}

async function Results(props: {
  lookup: SharedLookup | null;
  locale: string;
  coupleId: string | null;
  me: Watcher;
  language: string;
  t: Messages;
}) {
  const { lookup, me, language, t } = props;
  const partner = await getPartner();
  let results: SearchResult[] = [];
  let failed = false;
  if (lookup) {
    try {
      results = (await lookUp(lookup, props.locale)).slice(0, MAX_RESULTS);
    } catch (error) {
      console.error("Looking up a share failed", error);
      failed = true;
    }
  }

  if (results.length === 0) {
    const query = lookup?.kind === "search" ? lookup.query : "";
    return (
      <div className="card grid justify-items-center gap-3 px-6 py-10 text-center">
        <Couches size={56} />
        <p role={failed ? "alert" : undefined} className={`max-w-md font-semibold ${failed ? "text-danger" : ""}`}>
          {failed ? t.diary.share.failed : lookup ? t.diary.share.noResults : t.diary.share.nothing}
        </p>
        <Link href={query ? `/search?q=${encodeURIComponent(query)}` : "/search"} className="btn-quiet">
          <SearchIcon className="size-4" />
          {t.diary.share.search}
        </Link>
      </div>
    );
  }

  const onList = props.coupleId ? await getListKeys(props.coupleId) : null;
  const them: Watcher | null = partner?.country ? { country: partner.country, services: partner.services } : null;
  const card: CardContext = {
    language,
    // Started now, awaited by each badge, so the cards render before availability is known.
    availability: getAvailability(results, them ? [me.country, them.country] : [me.country]),
    me,
    them,
    partnerName: partner?.display_name || t.common.yourPartner,
    onList,
  };

  return (
    <section className="grid gap-2" aria-labelledby="share-results">
      <h2 id="share-results" className="display text-[2rem]">
        {t.diary.share.found}
      </h2>
      <ul className="grid grid-cols-2 gap-x-5 gap-y-8 pt-3 sm:grid-cols-3 md:grid-cols-4">
        {results.map((r, i) => (
          <TitleCard
            key={titleKey(r)}
            result={r}
            context={card}
            index={i}
            eager={i < 2}
            details={
              <span className="text-sm font-medium text-muted">
                {[r.release_date?.slice(0, 4), t.common.mediaType[r.media_type]].filter(Boolean).join(" · ")}
              </span>
            }
          />
        ))}
      </ul>
    </section>
  );
}
