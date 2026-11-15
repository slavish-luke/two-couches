import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  // Off on purpose: the tab bar's links use <Link prefetch={true}>, which (without Partial Prefetching) loads
  // each section's whole page in the background as soon as the app opens, so a tap shows it at once. With
  // Partial Prefetching on, links fetch only the App Shell, and per-user data (everything here reads the
  // session) can't be in it: the prefetch render stops before any database call returns (tried 2026-11-15).
  // Other links still prefetch only the static shell. Next 17 will force Partial Prefetching on: revisit then.
  partialPrefetching: false,
  experimental: {
    // Holds navigations and Server Actions while the network is down and retries them (useOffline()).
    useOffline: true,
    // Going back to a page seen in the last 2 minutes shows it straight away. Server Actions (refresh()) and
    // live changes (<CoupleSync>) clear it at once, and list pages refresh when the app comes back to the
    // foreground. The tab bar's prefetched pages follow staleTimes.static (5 minutes), cleared the same way.
    staleTimes: { dynamic: 120 },
  },
  images: {
    remotePatterns: [{ protocol: "https", hostname: "image.tmdb.org", pathname: "/t/p/**" }],
    // TMDB serves its own sizes (src/lib/image-loader.ts), so the srcset widths are TMDB's poster widths.
    loader: "custom",
    loaderFile: "./src/lib/image-loader.ts",
    // (For "50vw", Next leaves out widths under half the smallest device size, so 185 needs 342 here.)
    imageSizes: [92, 154, 185],
    deviceSizes: [342, 500, 780],
  },
  async headers() {
    return [
      // Nothing may frame the app (clickjacking), files are taken as the type they say they are, and other
      // sites only learn the origin a link came from, never a page's path (night IDs, feed tokens).
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
        ],
      },
      // Browsers re-check the service worker on every visit, so changes to it reach phones straight away.
      { source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache, no-store, must-revalidate" }] },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
