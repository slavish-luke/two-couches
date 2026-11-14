"use client";

import { useEffect } from "react";
import { installGround } from "@/lib/ground";
import { installLettering } from "@/lib/lettering";
import { installTouches } from "@/lib/motion-touches";

/**
 * Phase 10's global touches, installed once for every page (in the layout): jelly buttons, ink chips, the
 * "We can both watch" couches and trading-card posters (src/lib/motion-touches.ts), headings that land
 * (src/lib/lettering.ts) and the ground's flare, shooting stars and hidden-tab pause (src/lib/ground.ts).
 * Each reads the Motion level when it runs, so changing it in Settings needs no reload. Renders nothing.
 */
export function MotionEffects() {
  useEffect(() => {
    const controller = new AbortController();
    installTouches(controller.signal);
    installLettering(controller.signal);
    installGround(controller.signal);
    return () => {
      controller.abort();
    };
  }, []);
  return null;
}
