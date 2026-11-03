"use client";

import { useState, useTransition, type ReactNode } from "react";
import { getMessages } from "@/lib/i18n";
import type { NightMethod } from "@/lib/night-rules";
import {
  bothReady,
  compareLengths,
  formatLength,
  MAX_FILE_LABEL_LENGTH,
  usesOwnFiles,
  type ReadyCheck as Check,
} from "@/lib/ready-rules";
import { saveFile, setReady, type NightResult } from "./actions";

type Person = { id: string; name: string };

/**
 * Who's ready for a watch night and, when you're playing your own copies, which version each of you has
 * and whether the lengths match. You tick your own row; your partner's shows as they left it.
 */
export function ReadyCheck(props: {
  nightId: string;
  method: NightMethod | null;
  checks: Check[];
  me: Person;
  partner: Person | null;
  /** The film's runtime from TMDB in minutes, as a reference; null for series or when unknown. */
  runtime: number | null;
  language: string;
}) {
  const { me, partner, checks, language } = props;
  const t = getMessages(language).nights.ready;
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  const [editing, setEditing] = useState(false);

  const mine = checks.find((c) => c.profile_id === me.id);
  const theirs = partner ? checks.find((c) => c.profile_id === partner.id) : undefined;
  const files = usesOwnFiles(props.method);
  const both = bothReady(checks, me.id, partner?.id ?? null);
  const lengths = files ? compareLengths(mine?.file_seconds ?? null, theirs?.file_seconds ?? null) : null;

  function run(action: () => Promise<NightResult>, after?: () => void) {
    setError(undefined);
    startTransition(async () => {
      const result = await action();
      if (result.error) setError(result.error);
      else after?.();
    });
  }

  return (
    <div
      aria-busy={pending}
      className={`grid gap-2 rounded-lg border p-2.5 text-sm ${both ? "border-both bg-both-soft" : "border-line"}`}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <span className="font-semibold">{t.heading}</span>
        {both && (
          <span className="font-semibold text-both">
            <span aria-hidden>● </span>
            {t.bothReady}
          </span>
        )}
      </div>

      <ul className="grid gap-1.5">
        <Row person={me} check={mine} colour="text-me" files={files} language={language}>
          {mine?.ready_at ? (
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => setReady(props.nightId, false))}
              className="text-xs font-semibold text-muted hover:text-ink hover:underline disabled:opacity-50"
            >
              {t.undo}
            </button>
          ) : (
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => setReady(props.nightId, true))}
              className="btn px-3 py-1 text-sm"
            >
              {t.imReady}
            </button>
          )}
          {files && !editing && (
            <button
              type="button"
              disabled={pending}
              onClick={() => setEditing(true)}
              className="text-xs font-semibold text-partner hover:underline disabled:opacity-50"
            >
              {mine?.file_label || mine?.file_seconds ? t.changeFile : t.addFile}
            </button>
          )}
        </Row>
        {partner && <Row person={partner} check={theirs} colour="text-partner" files={files} language={language} />}
      </ul>

      {!mine?.ready_at && (
        <p className="text-xs text-muted">{props.method ? t.means[props.method] : t.meansUndecided}</p>
      )}

      {lengths && (
        <p className={lengths.same ? "text-both" : "font-semibold text-danger"}>
          {lengths.same ? t.sameLength(formatLength(mine!.file_seconds!)) : t.lengthsDiffer(formatLength(lengths.difference))}
        </p>
      )}

      {editing && (
        <FileForm
          // Start from what's saved, including a change that arrived from another screen.
          key={`${mine?.file_label}:${mine?.file_seconds}`}
          check={mine}
          runtime={props.runtime}
          pending={pending}
          language={language}
          onCancel={() => {
            setError(undefined);
            setEditing(false);
          }}
          onSave={(input) => run(() => saveFile(props.nightId, input), () => setEditing(false))}
        />
      )}

      {error && (
        <p role="alert" className="text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

/** One person: name, ready or not, the file they have, and (for you) the buttons. */
function Row(props: {
  person: Person;
  check: Check | undefined;
  colour: string;
  files: boolean;
  language: string;
  children?: ReactNode;
}) {
  const { check } = props;
  const t = getMessages(props.language).nights.ready;
  const file = [check?.file_label, check?.file_seconds ? formatLength(check.file_seconds) : null].filter(Boolean).join(" · ");
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <span className={`font-semibold ${props.colour}`}>{props.person.name}</span>
      <span className={check?.ready_at ? "font-semibold text-both" : "text-muted"}>
        {check?.ready_at ? `✓ ${t.ready}` : t.notYet}
      </span>
      {props.files && <span className="text-muted [overflow-wrap:anywhere]">{file || t.noFile}</span>}
      {props.children}
    </li>
  );
}

/** Your file's version and length. */
function FileForm(props: {
  check: Check | undefined;
  runtime: number | null;
  pending: boolean;
  language: string;
  onCancel: () => void;
  onSave: (input: { label: string; length: string }) => void;
}) {
  const t = getMessages(props.language).nights.ready;
  const [label, setLabel] = useState(props.check?.file_label ?? "");
  const [length, setLength] = useState(props.check?.file_seconds ? formatLength(props.check.file_seconds) : "");
  return (
    <form
      className="grid gap-3 border-t border-line pt-3"
      onSubmit={(e) => {
        e.preventDefault();
        props.onSave({ label, length });
      }}
    >
      <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
        <label className="grid gap-1">
          <span className="text-xs font-semibold">{t.fileLabel}</span>
          <input
            value={label}
            maxLength={MAX_FILE_LABEL_LENGTH}
            placeholder={t.fileLabelPlaceholder}
            onChange={(e) => setLabel(e.target.value)}
            className="field py-1.5"
          />
        </label>
        <label className="grid gap-1">
          <span className="text-xs font-semibold">{t.fileLength}</span>
          <input
            value={length}
            placeholder="1:52:03"
            onChange={(e) => setLength(e.target.value)}
            className="field py-1.5 tabular-nums"
          />
        </label>
      </div>
      <p className="text-xs text-muted">
        {t.fileLengthNote}
        {props.runtime ? ` ${t.runtime(props.runtime)}` : ""}
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <button className="btn px-3 py-1 text-sm" disabled={props.pending}>
          {props.pending ? t.saving : t.save}
        </button>
        <button type="button" onClick={props.onCancel} className="text-xs font-semibold text-muted hover:text-ink">
          {t.cancel}
        </button>
      </div>
    </form>
  );
}
