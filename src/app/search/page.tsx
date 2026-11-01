import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AddButton } from "@/components/add-button";
import { AvailabilityBadge } from "@/components/availability-badge";
import { ListSync } from "@/components/list-sync";
import { Poster } from "@/components/poster";
import { SearchBox } from "@/components/search-box";
import { getListKeys } from "@/lib/list";
import { getPartner, requireProfile } from "@/lib/session";
import { getAvailability, searchTitles, type SearchResult } from "@/lib/titles";
import { tmdbLocale } from "@/lib/tmdb";
import { titleHref, titleKey, type Watcher } from "@/lib/watch";

export const metadata = { title: "Search · Two Couches" };

export default function SearchPage({ searchParams }: PageProps<"/search">) {
  return (
    <Suspense fallback={<p className="text-muted">Loading…</p>}>
      <Search searchParams={searchParams} />
    </Suspense>
  );
}

async function Search({ searchParams }: Pick<PageProps<"/search">, "searchParams">) {
  const [profile, partner, { q }] = await Promise.all([requireProfile(), getPartner(), searchParams]);
  if (!profile.country) redirect("/settings?welcome=1");
  const query = (typeof q === "string" ? q : "").trim().slice(0, 100);

  let results: SearchResult[] = [];
  let failed = false;
  if (query) {
    try {
      results = await searchTitles(query, tmdbLocale(profile.language, profile.country));
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

  return (
    <div className="grid gap-6">
      <h1 className="font-display text-3xl font-bold tracking-tight">Search</h1>
      <SearchBox query={query} autoFocus={!query} />
      {profile.couple_id && <ListSync coupleId={profile.couple_id} />}

      {failed ? (
        <p className="text-danger">Search isn&apos;t working right now. Try again in a minute.</p>
      ) : query && results.length === 0 ? (
        <p className="text-muted">No films or series match “{query}”.</p>
      ) : (
        <ul className="grid gap-3">
          {results.map((r) => (
            <li key={titleKey(r)} className="card flex items-start gap-3 p-3 transition hover:border-muted">
              <Link href={titleHref(r)} className="flex min-w-0 flex-1 gap-4">
                <Poster path={r.poster_path} title={r.title} size="sm" />
                <div className="grid min-w-0 content-start gap-1">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <span className="font-display text-lg font-semibold leading-snug">{r.title}</span>
                    <span className="text-sm text-muted">
                      {r.release_date?.slice(0, 4)} {r.media_type === "movie" ? "Film" : "Series"}
                    </span>
                  </div>
                  <p className="line-clamp-2 text-sm text-muted">{r.overview}</p>
                  <Suspense>
                    <div>
                      <AvailabilityBadge
                        availability={availability}
                        titleKey={titleKey(r)}
                        me={me}
                        partner={them}
                        partnerName={partner?.display_name ?? null}
                      />
                    </div>
                  </Suspense>
                </div>
              </Link>
              {onList && (
                <AddButton
                  titleRef={{ media_type: r.media_type, tmdb_id: r.tmdb_id }}
                  onList={onList.has(titleKey(r))}
                />
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
