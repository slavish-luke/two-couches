import Image from "next/image";
import { ViewTransition } from "react";
import { getMessages } from "@/lib/i18n";
import { tmdbImage, type TitleRef } from "@/lib/watch";

/**
 * `tmdb` is the most each size asks for; screens with fewer pixels get a smaller TMDB size from the srcset
 * (src/lib/image-loader.ts). `sizes` is the widest each is shown.
 */
const SIZES = {
  xs: { width: 40, tmdb: "w92", sizes: "40px" },
  sm: { width: 64, tmdb: "w185", sizes: "64px" },
  md: { width: 92, tmdb: "w185", sizes: "92px" },
  lg: { width: 200, tmdb: "w500", sizes: "200px" },
  /** Fills its container's width: half a phone screen in grids, and about 130–220px in rows and on wider screens. */
  fluid: { width: 185, tmdb: "w342", sizes: "(min-width: 640px) 220px, 50vw" },
} as const;

/** The view-transition name for a title's poster (CSS identifiers can't hold titleKey()'s colon). */
export function posterMorph(ref: TitleRef) {
  return `poster-${ref.media_type}-${ref.tmdb_id}`;
}

/**
 * A 2:3 TMDB poster in an ink outline, or a blank card of the same shape. Served straight from TMDB's CDN.
 *
 * `morph` names the poster for a view transition, so it moves between pages that show the same title
 * (the list and the title page) instead of being swapped. A name must be unique on its page. `eager` is
 * for the one big poster a page leads with (its largest paint).
 */
export function Poster({
  path,
  title,
  size,
  language,
  morph,
  eager = false,
  className = "",
}: {
  path: string | null;
  title: string;
  size: keyof typeof SIZES;
  language: string;
  morph?: string;
  eager?: boolean;
  className?: string;
}) {
  const { width, tmdb, sizes } = SIZES[size];
  const height = Math.round(width * 1.5);
  const fluid = size === "fluid" ? "aspect-[2/3] h-auto w-full" : "";
  const poster = !path ? (
    <div
      style={fluid ? undefined : { width, height }}
      className={`shrink-0 rounded-poster border-[3px] border-outline bg-surface ${fluid} ${className}`}
      aria-hidden
    />
  ) : (
    <Image
      src={tmdbImage(path, tmdb)}
      alt={getMessages(language).common.poster(title)}
      width={width}
      height={height}
      sizes={sizes}
      // TMDB's smallest size has nothing smaller to pick from, so it needs no srcset.
      unoptimized={tmdb === "w92"}
      loading={eager ? "eager" : undefined}
      fetchPriority={eager ? "high" : undefined}
      className={`shrink-0 rounded-poster border-[3px] border-outline bg-surface object-cover ${fluid} ${className}`}
    />
  );
  return morph ? (
    <ViewTransition name={morph} share="morph" default="none">
      {poster}
    </ViewTransition>
  ) : (
    poster
  );
}
