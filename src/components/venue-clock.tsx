"use client";

import { useEffect, useState } from "react";
import { getMessages } from "@/lib/i18n";

/** "10:11" and "PM" apart (dayPeriod is empty on 24-hour clocks), and the weekday. */
function parts(date: Date, timeZone: string, language: string) {
  const time = new Intl.DateTimeFormat(language, { hour: "numeric", minute: "2-digit", timeZone }).formatToParts(date);
  return {
    // Node and browsers disagree on the space before AM/PM (narrow no-break or plain), which breaks hydration.
    full: time
      .map((part) => part.value)
      .join("")
      .replace(/[\u202f\u00a0]/g, " "),
    clock: time
      .filter((part) => part.type !== "dayPeriod")
      .map((part) => part.value)
      .join("")
      .trim(),
    dayPeriod: time.find((part) => part.type === "dayPeriod")?.value ?? "",
    day: new Intl.DateTimeFormat(language, { weekday: "long", timeZone }).format(date),
  };
}

/**
 * One person's clock in big cartoon numerals, with the weekday under it. Starts from the server's time and keeps
 * ticking in the browser.
 */
export function VenueClock({
  timeZone,
  language,
  serverNow,
}: {
  timeZone: string;
  language: string;
  /** The server's clock (ms), so the first render matches. */
  serverNow: number;
}) {
  const [now, setNow] = useState(serverNow);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const timer = setInterval(tick, 15_000);
    return () => clearInterval(timer);
  }, []);
  const { full, clock, dayPeriod, day } = parts(new Date(now), timeZone, language);

  return (
    <div data-clock className="grid justify-items-center gap-1">
      <time
        dateTime={new Date(now).toISOString()}
        className="display-ink block whitespace-nowrap text-[clamp(2rem,26cqi,3.5rem)] leading-none"
      >
        <span aria-hidden>{clock}</span>
        {dayPeriod && (
          <span aria-hidden className="ml-1 font-sans text-base font-bold">
            {dayPeriod}
          </span>
        )}
        <span className="sr-only">{getMessages(language).list.people.localTime(full)}</span>
      </time>
      <span className="text-sm font-semibold capitalize text-muted">{day}</span>
    </div>
  );
}
