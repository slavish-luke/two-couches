import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import type { SearchResult } from "@/lib/titles";
import { titleHref, titleKey, type Availability, type Watcher } from "@/lib/watch";
import { AddButton } from "./add-button";
import { AvailabilityBadge } from "./availability-badge";
import { Poster } from "./poster";

/** What every card on a page shares. */
export type CardContext = {
  language: string;
  /** Pending availability for the badges, or null for no badges (e.g. films still in cinemas). */
  availability: Promise<Record<string, Availability>> | null;
  me: Watcher;
  them: Watcher | null;
  partnerName: string;
  /** titleKey() of everything on our list, or null before pairing up (no list yet). */
  onList: Set<string> | null;
};

/**
 * A poster card for browse-style grids and rows: title, year (or `details` instead), who can watch it and
 * "+ Add". `children` go last, for extra actions.
 */
export function TitleCard({
  result,
  context,
  className = "",
  details,
  children,
}: {
  result: Pick<SearchResult, "media_type" | "tmdb_id" | "title" | "poster_path" | "release_date">;
  context: CardContext;
  className?: string;
  details?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <li className={`grid content-start justify-items-start gap-1.5 ${className}`}>
      <Link href={titleHref(result)} className="group grid w-full gap-1.5">
        <Poster path={result.poster_path} title={result.title} size="fluid" language={context.language} />
        <span className="line-clamp-2 font-semibold leading-snug group-hover:underline">{result.title}</span>
      </Link>
      {details ?? (result.release_date && <span className="text-xs text-muted">{result.release_date.slice(0, 4)}</span>)}
      {context.availability && (
        <Suspense>
          <AvailabilityBadge
            availability={context.availability}
            titleKey={titleKey(result)}
            me={context.me}
            partner={context.them}
            partnerName={context.them ? context.partnerName : null}
            language={context.language}
          />
        </Suspense>
      )}
      {context.onList && (
        <AddButton
          titleRef={{ media_type: result.media_type, tmdb_id: result.tmdb_id }}
          onList={context.onList.has(titleKey(result))}
          language={context.language}
        />
      )}
      {children}
    </li>
  );
}
