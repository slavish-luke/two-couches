import type { MetadataRoute } from "next";

// Enough for "Add to Home Screen", which iPhones need before they allow notifications. Icons come with
// the PWA work in Sprint 6.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Two Couches",
    short_name: "Two Couches",
    description: "Our shared watchlist, across two countries.",
    start_url: "/",
    display: "standalone",
    background_color: "#f5f7f8",
    theme_color: "#f5f7f8",
  };
}
