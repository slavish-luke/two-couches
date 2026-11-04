/**
 * next/image's loader (images.loaderFile in next.config.ts): TMDB images come straight from TMDB's CDN in
 * the TMDB size nearest above each width the browser might pick, never bigger than the size in `src`
 * (the most a component asks for). Nothing goes through Vercel's image optimisation, which has a quota.
 */

/** TMDB's poster widths; next.config.ts uses the same list for the srcset widths. */
const TMDB_WIDTHS = [92, 154, 185, 342, 500, 780];

const TMDB_IMAGE = /^(https:\/\/image\.tmdb\.org\/t\/p\/)w(\d+)(\/.+)$/;

export default function tmdbLoader({ src, width }: { src: string; width: number; quality?: number }) {
  const match = TMDB_IMAGE.exec(src);
  if (!match) return src;
  const [, base, largest, path] = match;
  const size = TMDB_WIDTHS.find((w) => w >= width && w <= Number(largest)) ?? Number(largest);
  return `${base}w${size}${path}`;
}
