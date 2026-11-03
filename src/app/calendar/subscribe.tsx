"use client";

import { useState, useTransition } from "react";
import { getMessages } from "@/lib/i18n";
import { makeCalendarFeed, stopCalendarFeed, type FeedResult } from "./actions";

/**
 * "Subscribe in your calendar": makes a private feed link of every watch night. The link is shown once,
 * right after it's made (only its hash is kept); after that you can only replace it or turn it off.
 */
export function CalendarSubscribe(props: {
  /** When your current link was made, already formatted ("3 Nov 2026"), or null if you have none. */
  madeOn: string | null;
  language: string;
}) {
  const t = getMessages(props.language).nights.calendar;
  const [pending, startTransition] = useTransition();
  const [token, setToken] = useState<string>();
  const [error, setError] = useState<string>();
  const [copied, setCopied] = useState(false);

  function run(action: () => Promise<FeedResult>, confirmText?: string) {
    if (confirmText && !window.confirm(confirmText)) return;
    setError(undefined);
    setCopied(false);
    startTransition(async () => {
      const result = await action();
      if (result.error) setError(result.error);
      else setToken(result.token);
    });
  }

  const host = typeof window === "undefined" ? "" : window.location.host;
  const https = token ? `${window.location.protocol}//${host}/calendar/${token}.ics` : "";
  const webcal = token ? `webcal://${host}/calendar/${token}.ics` : "";

  async function copy() {
    try {
      await navigator.clipboard.writeText(https);
      setCopied(true);
    } catch {
      document.getElementById("calendar-link")?.focus();
    }
  }

  return (
    <details className="group w-full rounded-xl border border-line bg-surface">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 font-semibold [&::-webkit-details-marker]:hidden">
        <span>{t.heading}</span>
        <span aria-hidden className="text-muted transition group-open:rotate-180">
          ▾
        </span>
      </summary>

      <div aria-busy={pending} className="grid gap-3 border-t border-line px-4 py-4 text-sm">
        <p className="text-muted">{t.intro}</p>

        {token ? (
          <>
            <div className="flex flex-wrap gap-2">
              <a href={webcal} className="btn">
                {t.subscribe}
              </a>
            </div>
            <label className="grid gap-1">
              <span className="font-semibold">{t.linkLabel}</span>
              <span className="flex gap-2">
                <input
                  id="calendar-link"
                  readOnly
                  value={https}
                  onFocus={(e) => e.currentTarget.select()}
                  className="field min-w-0 flex-1 font-mono text-xs"
                />
                <button type="button" onClick={copy} className="btn-quiet shrink-0">
                  {copied ? t.copied : t.copy}
                </button>
              </span>
            </label>
            <p className="font-semibold">{t.shownOnce}</p>
            <ul className="grid gap-2">
              <li>
                <span className="font-semibold">{t.google.name}: </span>
                {t.google.how}
              </li>
              <li>
                <span className="font-semibold">{t.apple.name}: </span>
                {t.apple.how}
              </li>
            </ul>
          </>
        ) : props.madeOn ? (
          <p>{t.haveLink(props.madeOn)}</p>
        ) : null}

        <p className="text-muted">{t.private}</p>

        <div className="flex flex-wrap gap-2">
          {props.madeOn || token ? (
            <>
              <button
                type="button"
                disabled={pending}
                onClick={() => run(makeCalendarFeed, t.confirmNew)}
                className="btn-quiet"
              >
                {pending ? t.working : t.makeNew}
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => run(stopCalendarFeed, t.confirmStop)}
                className="btn-quiet"
              >
                {t.stop}
              </button>
            </>
          ) : (
            <button type="button" disabled={pending} onClick={() => run(makeCalendarFeed)} className="btn">
              {pending ? t.working : t.make}
            </button>
          )}
        </div>

        {error && (
          <p role="alert" className="text-danger">
            {error}
          </p>
        )}
      </div>
    </details>
  );
}
