import Image from "next/image";
import { tmdbImage } from "@/lib/watch";
import { PersonIcon } from "./icons";

/**
 * TMDB's profile photos are 2:3 like posters and come in the same sizes, so they go through the same loader
 * (src/lib/image-loader.ts): `tmdb` is the most each size asks for. Never Vercel's image optimisation.
 */
const SIZES = {
  /** A cast card on the title page. */
  card: { width: 112, tmdb: "w185", sizes: "(min-width: 640px) 128px, 112px" },
  /** The person's own page: 200px, 240px from 640px wide, like the title page's poster. */
  page: { width: 200, tmdb: "w500", sizes: "(min-width: 640px) 240px, 200px" },
} as const;

/** A person's photo from TMDB in an ink outline, or a blank of the same shape with a drawn head. */
export function PersonPhoto({
  path,
  name,
  size,
  alt,
  eager = false,
  className = "",
}: {
  path: string | null;
  name: string;
  size: keyof typeof SIZES;
  /** The photo's alt text; empty where the name is written beside it. */
  alt: string;
  eager?: boolean;
  className?: string;
}) {
  const { width, tmdb, sizes } = SIZES[size];
  const frame = "aspect-[2/3] h-auto w-full shrink-0 rounded-poster border-[3px] border-outline bg-surface";
  if (!path) {
    return (
      <div aria-hidden title={name} className={`grid place-items-center text-muted ${frame} ${className}`}>
        <PersonIcon className="size-1/3" />
      </div>
    );
  }
  return (
    <Image
      src={tmdbImage(path, tmdb)}
      alt={alt}
      width={width}
      height={Math.round(width * 1.5)}
      sizes={sizes}
      loading={eager ? "eager" : undefined}
      fetchPriority={eager ? "high" : undefined}
      className={`object-cover ${frame} ${className}`}
    />
  );
}
