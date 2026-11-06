"use client";

import { useLayoutEffect, ViewTransition, type ReactNode } from "react";
import { flightIn, flightOut, notePath, type TransitionInstance } from "@/lib/flight";

/**
 * Wraps each page so moving between pages whooshes forward or peels back (src/lib/flight.ts). The root
 * template remounts it when the first path segment changes; sections with pages under them (watch nights,
 * title pages) have their own template with a `nested` one, which remounts when a deeper segment changes.
 * Only the outermost one that remounts animates. Refreshes, search-param changes and Suspense reveals
 * don't remount any of them, so they never animate.
 */
export function PageTransition({ children, nested = false }: { children: ReactNode; nested?: boolean }) {
  // The URL is already the new one when a page mounts (or comes back from Next's hidden cache). Not
  // usePathname(): that would keep every page from prerendering.
  useLayoutEffect(() => {
    notePath(location.pathname);
  }, []);

  return (
    <ViewTransition
      default="none"
      enter="page-in"
      exit="page-out"
      onEnter={(instance, types) => flightIn(instance as unknown as TransitionInstance, types)}
      onExit={(instance, types) => flightOut(instance as unknown as TransitionInstance, types)}
    >
      {nested ? <div data-subpage>{children}</div> : <div data-page>{children}</div>}
    </ViewTransition>
  );
}
