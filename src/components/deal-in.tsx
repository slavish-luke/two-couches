"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import { dealIfPressed, watchTabs } from "@/lib/list-motion";

/**
 * Tabs that deal the cards (Sprint 26). Put one inside the element that holds a tab's cards, beside them; it
 * deals that element's cards (`[data-list-card]`, `[data-title-card]`) when they first paint after a press of
 * one of the scope's tabs. Tabs are links marked `data-deal-tab={scope} data-deal-to={tab}`, with their
 * count (if any) in `[data-deal-count]`. `tab` is the tab now showing. Refreshes, other filters and pages
 * opened any other way never deal. Renders a hidden span.
 */
export function DealIn({ scope, tab }: { scope: string; tab: string }) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const root = ref.current?.parentElement;
    if (!root) return;
    return watchTabs(scope, root);
  }, [scope]);

  // Before paint, so the dealt cards never show in place first.
  useLayoutEffect(() => {
    const root = ref.current?.parentElement;
    if (root) dealIfPressed(scope, tab, root);
  }, [scope, tab]);

  return <span ref={ref} hidden data-deal-anchor />;
}
