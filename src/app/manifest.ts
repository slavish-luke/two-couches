import type { MetadataRoute } from "next";
import { DEFAULT_LOOK, PALETTE_COLORS } from "@/lib/theme";

// The icons are the two couches on the Sunburst ground (drawn by design/icons/build-icons.mjs). The launch screen is
// Sunburst yellow for every palette, to match the icon (the manifest can't know which palette a person picked).
// A manifest has one language, so it holds nothing to translate (no shortcuts); the name is the same in both.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Two Couches",
    short_name: "Two Couches",
    description: "Our shared watchlist, across two countries.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: PALETTE_COLORS[DEFAULT_LOOK.palette].ground,
    theme_color: PALETTE_COLORS[DEFAULT_LOOK.palette].ground,
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
