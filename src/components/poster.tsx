import Image from "next/image";
import { tmdbImage } from "@/lib/watch";

const SIZES = { sm: { width: 64, tmdb: "w185" }, lg: { width: 200, tmdb: "w500" } } as const;

/** A 2:3 TMDB poster, or a blank card of the same shape. Served straight from TMDB's CDN. */
export function Poster({ path, title, size }: { path: string | null; title: string; size: keyof typeof SIZES }) {
  const { width, tmdb } = SIZES[size];
  const height = Math.round(width * 1.5);
  if (!path) {
    return <div style={{ width, height }} className="shrink-0 rounded-lg border border-line bg-bg" aria-hidden />;
  }
  return (
    <Image
      src={tmdbImage(path, tmdb)}
      alt={`Poster for ${title}`}
      width={width}
      height={height}
      unoptimized
      className="shrink-0 rounded-lg border border-line bg-bg object-cover"
    />
  );
}
