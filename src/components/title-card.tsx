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
 * A poster card for browse-style grids and rows: an outlined poster with who-can-watch popped onto its top
 * corner, title, year (or `details` instead) and "+ Add". `children` go last, for extra actions. `index`
 * staggers the bursts popping in along a row or grid. `eager` loads the poster straight away, for the first
 * cards a page opens on (its largest paint).
 */
export function TitleCard({
  result,
  context,
  className = "",
  details,
  index = 0,
  eager = false,
  children,
}: {
  result: Pick<SearchResult, "media_type" | "tmdb_id" | "title" | "poster_path" | "release_date">;
  context: CardContext;
  className?: string;
  details?: ReactNode;
  index?: number;
  eager?: boolean;
  children?: ReactNode;
}) {
  const href = titleHref(result);
  return (
    <li className={`group/card grid content-start justify-items-start gap-1.5 ${className}`}>
      <div className="relative mb-1.5 w-full transition duration-200 ease-(--ease-spring) group-hover/card:-translate-y-1.5 group-hover/card:-rotate-2">
        {/* The title link below is the one for keyboards and screen readers. */}
        <Link href={href} tabIndex={-1} aria-hidden className="block">
          <Poster
            path={result.poster_path}
            title={result.title}
            size="fluid"
            language={context.language}
            eager={eager}
            className="shadow-[4px_4px_0_var(--outline)]"
          />
        </Link>
        {context.availability && (
          <div className="pointer-events-none absolute -top-4 -right-3 flex justify-end">
            <Suspense>
              <AvailabilityBadge
                availability={context.availability}
                titleKey={titleKey(result)}
                me={context.me}
                partner={context.them}
                partnerName={context.them ? context.partnerName : null}
                language={context.language}
                onPoster
                size="sm"
                index={index % 12}
              />
            </Suspense>
          </div>
        )}
      </div>
      <Link href={href} className="line-clamp-2 font-bold leading-snug hover:underline">
        {result.title}
      </Link>
      {details ?? (result.release_date && <span className="text-sm text-muted">{result.release_date.slice(0, 4)}</span>)}
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
