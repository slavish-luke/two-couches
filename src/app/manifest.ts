import type { MetadataRoute } from "next";
import { THEME_COLORS } from "@/lib/theme";

// The icons are drawn from src/app/icon.svg (two circles: you, your partner, and where you overlap).
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
    background_color: THEME_COLORS.light,
    theme_color: THEME_COLORS.light,
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
