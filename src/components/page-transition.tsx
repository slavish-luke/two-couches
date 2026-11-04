"use client";

import { ViewTransition, type ReactNode } from "react";
import { flightIn, flightOut, type TransitionInstance } from "@/lib/flight";

/**
 * Wraps each page (from the root template, which remounts when the first path segment changes) so moving
 * between pages whooshes forward or peels back (src/lib/flight.ts). Refreshes, search-param changes and
 * Suspense reveals don't remount it, so they never animate.
 */
export function PageTransition({ children }: { children: ReactNode }) {
  return (
    <ViewTransition
      default="none"
      enter="page-in"
      exit="page-out"
      onEnter={(instance, types) => flightIn(instance as unknown as TransitionInstance, types)}
      onExit={(instance, types) => flightOut(instance as unknown as TransitionInstance, types)}
    >
      <div data-page>{children}</div>
    </ViewTransition>
  );
}
