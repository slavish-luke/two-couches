import Image from "next/image";
import { getMessages } from "@/lib/i18n";
import { tmdbImage } from "@/lib/watch";

const SIZES = {
  sm: { width: 64, tmdb: "w185" },
  lg: { width: 200, tmdb: "w500" },
  /** Fills its container's width, e.g. a grid cell. */
  fluid: { width: 185, tmdb: "w342" },
} as const;

/** A 2:3 TMDB poster, or a blank card of the same shape. Served straight from TMDB's CDN. */
export function Poster({
  path,
  title,
  size,
  language,
}: {
  path: string | null;
  title: string;
  size: keyof typeof SIZES;
  language: string;
}) {
  const { width, tmdb } = SIZES[size];
  const height = Math.round(width * 1.5);
  const fluid = size === "fluid" ? "aspect-[2/3] h-auto w-full" : "";
  if (!path) {
    return (
      <div
        style={fluid ? undefined : { width, height }}
        className={`shrink-0 rounded-lg border border-line bg-bg ${fluid}`}
        aria-hidden
      />
    );
  }
  return (
    <Image
      src={tmdbImage(path, tmdb)}
      alt={getMessages(language).common.poster(title)}
      width={width}
      height={height}
      unoptimized
      className={`shrink-0 rounded-lg border border-line bg-bg object-cover ${fluid}`}
    />
  );
}
