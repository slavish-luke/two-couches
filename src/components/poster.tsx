import Image from "next/image";
import { getMessages } from "@/lib/i18n";
import { tmdbImage } from "@/lib/watch";

/**
 * `tmdb` is the most each size asks for; screens with fewer pixels get a smaller TMDB size from the srcset
 * (src/lib/image-loader.ts). `sizes` is the widest each is shown.
 */
const SIZES = {
  xs: { width: 40, tmdb: "w92", sizes: "40px" },
  sm: { width: 64, tmdb: "w185", sizes: "64px" },
  lg: { width: 200, tmdb: "w500", sizes: "200px" },
  /** Fills its container's width: half a phone screen in grids, and about 130–180px in rows and on wider screens. */
  fluid: { width: 185, tmdb: "w342", sizes: "(min-width: 640px) 180px, 50vw" },
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
  const { width, tmdb, sizes } = SIZES[size];
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
      sizes={sizes}
      className={`shrink-0 rounded-lg border border-line bg-bg object-cover ${fluid}`}
    />
  );
}
