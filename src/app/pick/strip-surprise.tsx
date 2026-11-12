"use client";

import { useEffect } from "react";

/**
 * Brings the shuffling pick into view (on phones it sits under the time card), then takes `surprise=1`
 * back out of the address, so reloading or sharing the page shows the pick plainly. Renders nothing.
 */
export function StripSurprise() {
  useEffect(() => {
    document.querySelector("[data-surprise]")?.scrollIntoView({ block: "center", behavior: "instant" });
    const url = new URL(location.href);
    if (!url.searchParams.has("surprise")) return;
    url.searchParams.delete("surprise");
    history.replaceState(history.state, "", url);
  }, []);
  return null;
}
