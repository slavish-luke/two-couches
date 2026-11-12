"use client";

import { useEffect, useState } from "react";
import { BusyIcon, MoonIcon, SofaIcon } from "@/components/icons";
import { getMessages } from "@/lib/i18n";
import { clockState, nextStateChange } from "@/lib/time-rules";

/**
 * Under a Home clock: free time, busy hours or probably asleep on that person's clock (clockState()). Starts
 * from the server's time, then changes on the hour (and when the tab comes back).
 */
export function ClockState({
  timeZone,
  name,
  language,
  serverNow,
}: {
  timeZone: string;
  /** Whose clock it is, for screen readers ("You", or the partner's name). */
  name: string;
  language: string;
  serverNow: number;
}) {
  const [now, setNow] = useState(serverNow);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      clearTimeout(timer);
      const at = Date.now();
      setNow(at);
      timer = setTimeout(schedule, nextStateChange(new Date(at), timeZone));
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") schedule();
    };
    timer = setTimeout(schedule, nextStateChange(new Date(), timeZone));
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [timeZone]);

  const state = clockState(new Date(now), timeZone);
  const text = getMessages(language).time.clock;
  return (
    <span
      data-clock-state={state}
      className="relative inline-flex max-w-full items-center gap-1 whitespace-nowrap rounded-full border-2 border-outline bg-surface px-2 text-[min(0.8125rem,8.4cqi)] font-bold leading-snug"
    >
      {state === "free" ? (
        <SofaIcon className="size-[1.15em]" />
      ) : state === "awake" ? (
        <BusyIcon className="size-[1.15em]" />
      ) : (
        <MoonIcon className="size-[1.15em]" filled />
      )}
      <span aria-hidden className="truncate">
        {text[state]}
      </span>
      <span className="sr-only">{text.label(name, text[state])}</span>
    </span>
  );
}
