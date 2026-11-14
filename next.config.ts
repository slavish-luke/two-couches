import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  experimental: {
    // Holds navigations and Server Actions while the network is down and retries them (useOffline()).
    useOffline: true,
    // Going back to a page seen in the last 30 s shows it straight away. Live sync and Server Actions
    // refresh it, and <ListSync> refreshes whenever the app comes back to the foreground.
    staleTimes: { dynamic: 30 },
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
