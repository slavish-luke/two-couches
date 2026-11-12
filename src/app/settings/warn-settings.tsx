"use client";

import { useEffect, useOptimistic, useRef, useState, useTransition } from "react";
import { CloseIcon, PlusIcon, SearchIcon } from "@/components/icons";
import { MAX_WARN_KEYWORDS, type Keyword } from "@/lib/guidance-rules";
import { getMessages } from "@/lib/i18n";
import { addWarnKeyword, findKeywords, removeWarnKeyword } from "./warn-actions";

type Change = { add: Keyword } | { remove: number };

/**
 * Settings → "Warn me about" (Sprint 19): your topics as chips to remove, a search of TMDB's keywords to
 * add more, and your partner's topics (read only), since their page warns you about them too.
 */
export function WarnSettings(props: { mine: Keyword[]; partner: { name: string; keywords: Keyword[] } | null; language: string }) {
  const t = getMessages(props.language).discovery.warn;
  const [mine, change] = useOptimistic(props.mine, (list: Keyword[], c: Change) =>
    "add" in c ? (list.some((k) => k.id === c.add.id) ? list : [...list, c.add]) : list.filter((k) => k.id !== c.remove),
  );
  const [, startSaving] = useTransition();
  const [, startSearching] = useTransition();
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<{ query: string; results: Keyword[] } | null>(null);
  const [error, setError] = useState<string>();
  const latest = useRef("");
  const q = query.replace(/\s+/g, " ").trim();
  // Only the answer to what's in the box now: an older search that lands late is ignored.
  const results = q.length >= 2 && found?.query === q ? found.results : null;

  // Searches TMDB a moment after typing stops.
  useEffect(() => {
    latest.current = q;
    if (q.length < 2) return;
    const timer = setTimeout(() => {
      startSearching(async () => {
        const answer = await findKeywords(q);
        if (latest.current !== q) return;
        setError(answer.error);
        setFound({ query: q, results: answer.results ?? [] });
      });
    }, 300);
    return () => {
      clearTimeout(timer);
    };
  }, [q]);

  const save = (c: Change) =>
    startSaving(async () => {
      change(c);
      const result = "add" in c ? await addWarnKeyword(c.add.id) : await removeWarnKeyword(c.remove);
      setError(result.error);
    });

  const full = mine.length >= MAX_WARN_KEYWORDS;
  const shown = (results ?? []).filter((k) => !mine.some((m) => m.id === k.id));

  return (
    <div className="grid gap-5">
      <div className="grid gap-2">
        <h3 className="font-bold">{t.yours}</h3>
        {mine.length === 0 ? (
          <p className="text-muted">{t.empty}</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {mine.map((k) => (
              <li key={k.id}>
                <button type="button" onClick={() => save({ remove: k.id })} aria-label={t.remove(k.name)} className="chip">
                  {k.name}
                  <CloseIcon className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="grid gap-2">
        <label className="grid gap-1.5">
          <span className="font-semibold">{t.search}</span>
          <span className="relative flex items-center">
            <SearchIcon className="pointer-events-none absolute left-3.5 size-5" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t.placeholder}
              maxLength={60}
              autoComplete="off"
              disabled={full}
              className="field w-full pl-11"
            />
          </span>
        </label>
        {full && <p className="text-sm font-semibold">{t.limit}</p>}
        <div aria-live="polite" className="grid gap-2">
          {q.length >= 2 && results === null && !error && <p className="text-sm text-muted">{t.searching}</p>}
          {results !== null && shown.length === 0 && <p className="text-sm text-muted">{t.noResults}</p>}
          {shown.length > 0 && (
            <ul className="flex flex-wrap gap-2">
              {shown.map((k) => (
                <li key={k.id}>
                  <button
                    type="button"
                    disabled={full}
                    onClick={() => save({ add: k })}
                    aria-label={t.add(k.name)}
                    className="chip"
                  >
                    <PlusIcon className="size-3.5" />
                    {k.name}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        {error && (
          <p role="alert" className="text-sm font-semibold text-danger">
            {error}
          </p>
        )}
      </div>

      {props.partner && (
        <div className="grid gap-2 border-t-2 border-outline/15 pt-4">
          <h3 className="font-bold">{t.partners(props.partner.name)}</h3>
          {props.partner.keywords.length === 0 ? (
            <p className="text-muted">{t.empty}</p>
          ) : (
            <ul className="flex flex-wrap gap-1.5">
              {props.partner.keywords.map((k) => (
                <li key={k.id} className="strand">
                  {k.name}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
