"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { DoneTag } from "@/components/done-tag";
import { UploadIcon } from "@/components/icons";
import { Poster } from "@/components/poster";
import { getMessages } from "@/lib/i18n";
import {
  IMPORT_BATCH,
  MATCH_BATCH,
  MAX_IMPORT_ROWS,
  mergeRows,
  readExport,
  toImport,
  type ImportItem,
  type ImportRow,
  type MatchResult,
} from "@/lib/import-rules";
import { importTitles, matchImport } from "./import-actions";

type Match = MatchResult["match"];

type Phase =
  | { step: "idle" }
  | { step: "reading" }
  | { step: "matching"; done: number; total: number }
  | { step: "preview"; rows: ImportRow[]; matches: Map<string, Match>; capped: number | null }
  | { step: "importing"; done: number; total: number }
  | { step: "done"; added: number; failed: number };

/**
 * "Bring in your history": pick Letterboxd or IMDb CSV exports, see what was found (and what's already on
 * the list or not on TMDB), then add them. The files are read here in the browser; only the titles' names,
 * years and IMDb IDs go to the server, in batches.
 */
export function ImportHistory({ language }: { language: string }) {
  const t = getMessages(language).diary.import;
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>({ step: "idle" });
  const [errors, setErrors] = useState<string[]>([]);

  async function read(files: File[]) {
    setErrors([]);
    setPhase({ step: "reading" });
    const problems: string[] = [];
    const all: ImportRow[] = [];
    for (const file of files) {
      try {
        const rows = readExport(file.name, await file.text());
        if (rows === null) problems.push(t.errors.unknownFormat(file.name));
        else all.push(...rows);
      } catch {
        problems.push(t.errors.unreadable(file.name));
      }
    }
    const merged = mergeRows(all);
    if (merged.length === 0) {
      setErrors(problems.length ? problems : [t.errors.empty]);
      setPhase({ step: "idle" });
      return;
    }
    setErrors(problems);
    const rows = merged.slice(0, MAX_IMPORT_ROWS);
    const matches = new Map<string, Match>();
    for (let i = 0; i < rows.length; i += MATCH_BATCH) {
      setPhase({ step: "matching", done: i, total: rows.length });
      const batch = rows.slice(i, i + MATCH_BATCH).map(({ key, name, year, imdb, type }) => ({ key, name, year, imdb, type }));
      const result = await matchImport(batch).catch(() => ({ error: t.errors.failed }));
      if ("error" in result) {
        setErrors([...problems, result.error]);
        setPhase({ step: "idle" });
        return;
      }
      for (const r of result.results) matches.set(r.key, r.match);
    }
    setPhase({ step: "preview", rows, matches, capped: merged.length > MAX_IMPORT_ROWS ? merged.length : null });
  }

  async function add(items: ImportItem[]) {
    setErrors([]);
    let added = 0;
    let failed = 0;
    for (let i = 0; i < items.length; i += IMPORT_BATCH) {
      setPhase({ step: "importing", done: i, total: items.length });
      const batch = items.slice(i, i + IMPORT_BATCH);
      const result = await importTitles(batch).catch(() => ({ error: t.errors.failed }));
      if ("error" in result) failed += batch.length;
      else {
        added += result.added;
        failed += result.failed;
      }
    }
    setPhase({ step: "done", added, failed });
    router.refresh();
  }

  const startAgain = (
    <button type="button" className="btn-quiet w-fit" onClick={() => setPhase({ step: "idle" })}>
      {t.startAgain}
    </button>
  );

  return (
    <div data-import className="grid gap-4">
      <p className="max-w-[65ch] text-sm font-medium text-muted">{t.rules}</p>

      {phase.step === "idle" && (
        <label className="btn-quiet w-fit cursor-pointer has-focus-visible:outline-3 has-focus-visible:outline-offset-3 has-focus-visible:outline-accent">
          <UploadIcon className="size-4" />
          {t.choose}
          <input
            type="file"
            accept=".csv,text/csv"
            multiple
            className="sr-only"
            onChange={(e) => {
              const files = [...(e.target.files ?? [])];
              e.target.value = "";
              if (files.length) void read(files);
            }}
          />
        </label>
      )}

      {(phase.step === "reading" || phase.step === "matching" || phase.step === "importing") && (
        <Progress
          label={phase.step === "reading" ? t.reading : phase.step === "matching" ? t.matching(phase.done, phase.total) : t.importing(phase.done, phase.total)}
          share={phase.step === "reading" ? 0 : phase.done / Math.max(1, phase.total)}
        />
      )}

      {errors.length > 0 && (
        <ul role="alert" className="grid gap-1 text-sm font-semibold text-danger">
          {errors.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      )}

      {phase.step === "preview" && <Preview phase={phase} language={language} onAdd={add} startAgain={startAgain} />}

      {phase.step === "done" && (
        <div className="grid gap-3">
          {phase.added > 0 ? <DoneTag status>{t.done(phase.added)}</DoneTag> : <p role="status" className="font-medium">{t.nothingNew}</p>}
          {phase.failed > 0 && <p className="text-sm font-semibold text-danger">{t.someFailed(phase.failed)}</p>}
          {startAgain}
        </div>
      )}
    </div>
  );
}

/** "Looking up 40 of 120…" over a bar that fills as it goes. */
function Progress({ label, share }: { label: string; share: number }) {
  return (
    <div className="grid gap-1.5">
      <p role="status" className="font-semibold">
        {label}
      </p>
      <div aria-hidden className="h-4 overflow-hidden rounded-full border-[2.5px] border-outline bg-surface">
        <div className="h-full origin-left bg-accent transition-transform duration-300 motion-reduce:transition-none" style={{ transform: `scaleX(${Math.max(0.02, share)})` }} />
      </div>
    </div>
  );
}

function Preview({
  phase,
  language,
  onAdd,
  startAgain,
}: {
  phase: Extract<Phase, { step: "preview" }>;
  language: string;
  onAdd: (items: ImportItem[]) => void;
  startAgain: ReactNode;
}) {
  const t = getMessages(language).diary.import;
  const items = toImport(phase.rows, phase.matches);
  const onList = phase.rows.filter((r) => phase.matches.get(r.key)?.onList).length;
  const missing = phase.rows.filter((r) => !phase.matches.get(r.key));
  const watched = items.filter((i) => i.status === "watched").length;
  const rounded = phase.rows.some((r) => r.rounded);
  // A few of the posters about to be added, so it's clear the right titles were found.
  const shown = new Set(items.slice(0, 12).map((i) => `${i.media_type}:${i.tmdb_id}`));
  const posters = [...phase.matches.values()].filter((m): m is NonNullable<Match> => !!m && shown.delete(`${m.media_type}:${m.tmdb_id}`));

  return (
    <div data-import-preview className="grid gap-4">
      <div className="grid gap-1">
        {items.length > 0 ? <p className="display-ink text-2xl">{t.ready(items.length)}</p> : <p className="font-semibold">{t.nothingNew}</p>}
        {items.length > 0 && (
          <p className="font-semibold">
            {[t.toUpNext(items.length - watched), t.toWatched(watched)].join(" · ")}
          </p>
        )}
        <ul className="grid gap-0.5 text-sm font-medium text-muted">
          {onList > 0 && <li>{t.onList(onList)}</li>}
          {missing.length > 0 && <li>{t.notFound(missing.length)}</li>}
          {phase.capped && <li>{t.capped(MAX_IMPORT_ROWS, phase.capped)}</li>}
          {rounded && <li>{t.rounded}</li>}
        </ul>
      </div>
      {posters.length > 0 && (
        <ul aria-hidden className="flex flex-wrap gap-2">
          {posters.map((m) => (
            <li key={`${m.media_type}:${m.tmdb_id}`}>
              <Poster path={m.poster_path} title={m.title} size="xs" language={language} />
            </li>
          ))}
        </ul>
      )}
      {missing.length > 0 && (
        <details className="text-sm">
          <summary className="tap-area w-fit cursor-pointer font-bold underline underline-offset-4">{t.showNotFound}</summary>
          <ul className="mt-2 grid max-h-48 gap-0.5 overflow-y-auto font-medium">
            {missing.map((r) => (
              <li key={r.key}>
                {r.name}
                {r.year ? ` (${r.year})` : ""}
              </li>
            ))}
          </ul>
        </details>
      )}
      <div className="flex flex-wrap gap-2.5">
        {items.length > 0 && (
          <button type="button" className="btn" onClick={() => onAdd(items)}>
            {t.add(items.length)}
          </button>
        )}
        {startAgain}
      </div>
    </div>
  );
}
