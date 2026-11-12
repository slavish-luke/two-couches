"use client";

import { useEffect, useState } from "react";
import { countdown, formatCountdown, nextTick } from "@/lib/planning-rules";

/**
 * The time left until a night, ticking in the browser: "in 2 d 4 h", "in 35 min", "Starting now", then
 * "Under way". Starts from the server's clock so the first render matches, then wakes when the words change.
 * Once it's starting it becomes a grape tag, like the night card's "Under way".
 */
export function Countdown({ startsAt, serverNow, language }: { startsAt: string; serverNow: number; language: string }) {
  const [now, setNow] = useState(serverNow);
  useEffect(() => {
    const start = new Date(startsAt);
    let timer: ReturnType<typeof setTimeout> | undefined;
    const tick = () => {
      const at = Date.now();
      setNow(at);
      const wait = nextTick(start, new Date(at));
      // At most a minute, so a computer waking from sleep catches up soon.
      if (wait !== null) timer = setTimeout(tick, Math.min(wait, 60_000));
    };
    timer = setTimeout(tick, 0);
    return () => {
      clearTimeout(timer);
    };
  }, [startsAt]);

  const start = new Date(startsAt);
  const kind = countdown(start, new Date(now)).kind;
  const started = kind === "now" || kind === "underWay";
  return (
    <time
      dateTime={startsAt}
      data-countdown={kind}
      className={
        started
          ? "rounded-full border-2 border-outline bg-accent px-2 text-sm font-bold text-on-accent"
          : "paper -rotate-2 whitespace-nowrap rounded-full border-2 border-outline px-2 text-sm font-bold tabular-nums"
      }
    >
      {formatCountdown(start, new Date(now), language)}
    </time>
  );
}
