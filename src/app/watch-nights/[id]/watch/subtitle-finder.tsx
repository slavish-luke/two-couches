"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { getMessages } from "@/lib/i18n";
import type { SubtitleOption } from "@/lib/opensubtitles";
import { dateLocale, LANGUAGES } from "@/lib/places";
import { findSubtitles, loadSubtitles } from "./actions";

type Episode = { season: number; episode: number };

/**
 * Subtitles from OpenSubtitles for the night's title, in either of the app's languages: those timed for
 * your file (its hash, worked out in the browser) come first. Picking one hands its WebVTT to `onLoad`.
 * Searching is free; each new file costs one of the account's daily downloads (then it's cached).
 */
export function SubtitleFinder(props: {
  nightId: string;
  language: string;
  /** The OpenSubtitles hash of your file, or null while it's being worked out (or for tiny files). */
  hash: string | null;
  /** Searched for when the night has no title: your file's name. */
  query: string;
  /** For a series: the episode to start from (the next one on your list). */
  episode: Episode | null;
  onLoad: (vtt: string, label: string) => void;
  onClose: () => void;
}) {
  const text = getMessages(props.language).nights.room.find;
  const [language, setLanguage] = useState(props.language);
  const [episode, setEpisode] = useState(props.episode);
  const [options, setOptions] = useState<SubtitleOption[] | null>(null);
  const [error, setError] = useState<string>();
  const [searching, startSearch] = useTransition();
  const [loading, setLoading] = useState<number | null>(null);
  const panel = useRef<HTMLElement>(null);

  // It opens below the video: bring it into view, once. In braces: newer browsers return a Promise from
  // scrollIntoView(), and an effect must return nothing or a cleanup function (React calls it on unmount).
  useEffect(() => {
    panel.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, []);

  function search(lang = language, ep = episode) {
    startSearch(async () => {
      setError(undefined);
      const result = await findSubtitles(props.nightId, {
        language: lang,
        hash: props.hash,
        season: ep?.season,
        episode: ep?.episode,
        query: props.query,
      });
      if ("error" in result) {
        setOptions(null);
        setError(result.error);
      } else {
        setOptions(result.options);
      }
    });
  }

  // Search straight away, and again once your file's hash is ready (so matches for it rise to the top).
  const { hash } = props;
  useEffect(() => {
    search();
    // Only the hash arriving should search again; language and episode changes search from their controls.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hash]);

  async function use(option: SubtitleOption) {
    setError(undefined);
    setLoading(option.fileId);
    const result = await loadSubtitles(props.nightId, { fileId: option.fileId, language: option.language, release: option.release });
    setLoading(null);
    if ("vtt" in result) {
      props.onLoad(result.vtt, option.release || LANGUAGES[language as keyof typeof LANGUAGES] || option.language);
    } else if ("quota" in result) {
      const time = result.quota
        ? new Date(result.quota).toLocaleTimeString(dateLocale(props.language), { hour: "numeric", minute: "2-digit" })
        : null;
      setError(text.errors.quota(time));
    } else {
      setError(result.error);
    }
  }

  return (
    <section
      aria-busy={searching}
      className="card grid gap-3 p-4 text-sm"
      ref={panel}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-bold">{text.heading}</h2>
        <button type="button" onClick={props.onClose} className="tap-area font-bold underline underline-offset-4">
          {text.close}
        </button>
      </div>

      <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
        <div role="radiogroup" aria-label={text.language} className="flex flex-wrap gap-2">
          {Object.entries(LANGUAGES).map(([code, name]) => (
            <button
              key={code}
              type="button"
              role="radio"
              aria-checked={language === code}
              onClick={() => {
                setLanguage(code);
                search(code);
              }}
              className="chip"
            >
              {name}
            </button>
          ))}
        </div>
        {episode && (
          <form
            className="flex flex-wrap items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              search();
            }}
          >
            {(["season", "episode"] as const).map((key) => (
              <label key={key} className="grid gap-1">
                <span className="font-semibold">{text[key]}</span>
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={999}
                  value={episode[key]}
                  onChange={(e) => setEpisode({ ...episode, [key]: Math.max(1, Number(e.target.value) || 1) })}
                  className="field w-20 py-1.5 tabular-nums"
                />
              </label>
            ))}
            <button className="btn-quiet" disabled={searching}>
              {text.search}
            </button>
          </form>
        )}
      </div>

      {searching && !options && <p className="font-semibold text-muted">{text.searching}</p>}
      {options && options.length === 0 && !searching && <p className="font-semibold">{text.none}</p>}
      {options && options.length > 0 && (
        <ul className={`grid gap-2 transition-opacity ${searching ? "opacity-50" : ""}`}>
          {options.map((option) => (
            <li key={option.fileId} className="paper flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-control border-[3px] border-outline p-2.5">
              <div className="grid min-w-0 flex-1 gap-1">
                <span className="font-semibold [overflow-wrap:anywhere]">{option.release || option.language}</span>
                <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-muted">
                  {option.matchesFile && (
                    <span className="rounded-full border-2 border-outline bg-accent px-2 text-xs font-bold text-on-accent">{text.matchesFile}</span>
                  )}
                  <span className="tabular-nums">{text.downloads(option.downloads)}</span>
                  {option.hearingImpaired && <span>{text.hearingImpaired}</span>}
                  {option.machine && <span>{text.machine}</span>}
                </span>
              </div>
              <button type="button" className="btn-quiet" disabled={loading !== null} onClick={() => void use(option)}>
                {loading === option.fileId ? text.loading : text.use}
              </button>
            </li>
          ))}
        </ul>
      )}
      {error && (
        <p role="alert" className="font-semibold text-danger">
          {error}
        </p>
      )}
      <p className="text-xs text-muted">{text.source}</p>
    </section>
  );
}
