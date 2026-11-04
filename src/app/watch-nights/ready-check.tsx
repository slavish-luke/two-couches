"use client";

import { useState, useTransition, type CSSProperties, type ReactNode } from "react";
import { Couches } from "@/components/couch";
import { CheckIcon } from "@/components/icons";
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

  const textButton =
    "text-sm font-bold underline underline-offset-4 transition hover:decoration-[3px] disabled:opacity-50";

  // A paper slip of its own, so it reads the same on a card and inside the home page's grape spotlight.
  return (
    <div
      aria-busy={pending}
      className={`paper grid gap-2.5 rounded-control border-[3px] border-outline p-3 text-sm ${both ? "bg-both-soft" : ""}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
        <span className="text-base font-bold">{t.heading}</span>
        {both && (
          // You're both ready: the two couches turn up, and a bubblegum tag pops in like the BOTH burst.
          <span className="inline-flex items-center gap-2">
            <Couches size={34} />
            <span
              style={{ "--r": "-3deg", rotate: "var(--r)" } as CSSProperties}
              className="burst inline-flex items-center gap-1.5 rounded-full border-[2.5px] border-outline bg-stamp px-3 pb-0.5 pt-1 font-display text-base leading-none tracking-[0.03em] text-on-stamp shadow-[var(--lift-sm)_var(--lift-sm)_0_var(--outline)]"
            >
              <CheckIcon className="size-4 [stroke-width:3]" />
              {t.bothReady}
            </span>
          </span>
        )}
      </div>

      <ul className="grid gap-2">
        <Row person={me} check={mine} fill="bg-me" files={files} language={language}>
          {mine?.ready_at ? (
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => setReady(props.nightId, false))}
              className={textButton}
            >
              {t.undo}
            </button>
          ) : (
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => setReady(props.nightId, true))}
              className="btn px-3.5 pb-1.5 pt-2 text-base"
            >
              {t.imReady}
            </button>
          )}
          {files && !editing && (
            <button type="button" disabled={pending} onClick={() => setEditing(true)} className={textButton}>
              {mine?.file_label || mine?.file_seconds ? t.changeFile : t.addFile}
            </button>
          )}
        </Row>
        {partner && <Row person={partner} check={theirs} fill="bg-partner" files={files} language={language} />}
      </ul>

      {!mine?.ready_at && (
        <p className="text-muted">{props.method ? t.means[props.method] : t.meansUndecided}</p>
      )}

      {lengths &&
        (lengths.same ? (
          <p className="flex items-start gap-2 font-semibold">
            <span
              aria-hidden
              className="mt-px grid size-5 shrink-0 place-items-center rounded-full border-2 border-outline bg-accent text-on-accent"
            >
              <CheckIcon className="size-3 [stroke-width:3.5]" />
            </span>
            {t.sameLength(formatLength(mine!.file_seconds!))}
          </p>
        ) : (
          <p className="font-semibold text-danger">{t.lengthsDiffer(formatLength(lengths.difference))}</p>
        ))}

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
        <p role="alert" className="font-semibold text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

/** One person: their name tag, ready or not, the file they have, and (for you) the buttons. */
function Row(props: {
  person: Person;
  check: Check | undefined;
  /** The person's colour, as a background class. */
  fill: string;
  files: boolean;
  language: string;
  children?: ReactNode;
}) {
  const { check } = props;
  const t = getMessages(props.language).nights.ready;
  const file = [check?.file_label, check?.file_seconds ? formatLength(check.file_seconds) : null].filter(Boolean).join(" · ");
  return (
    <li className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
      <span
        className={`max-w-full truncate rounded-full border-[2.5px] border-outline px-2.5 text-sm font-bold ${props.fill}`}
      >
        {props.person.name}
      </span>
      {check?.ready_at ? (
        <span className="inline-flex items-center gap-1 rounded-full border-2 border-outline bg-accent py-px pl-1.5 pr-2.5 text-sm font-bold text-on-accent">
          <CheckIcon className="size-4 [stroke-width:3]" />
          {t.ready}
        </span>
      ) : (
        <span className="font-semibold text-muted">{t.notYet}</span>
      )}
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
      className="grid gap-3 border-t-2 border-outline/15 pt-3"
      onSubmit={(e) => {
        e.preventDefault();
        props.onSave({ label, length });
      }}
    >
      <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
        <label className="grid gap-1">
          <span className="text-sm font-semibold">{t.fileLabel}</span>
          <input
            value={label}
            maxLength={MAX_FILE_LABEL_LENGTH}
            placeholder={t.fileLabelPlaceholder}
            onChange={(e) => setLabel(e.target.value)}
            className="field py-1.5"
          />
        </label>
        <label className="grid gap-1">
          <span className="text-sm font-semibold">{t.fileLength}</span>
          <input
            value={length}
            placeholder="1:52:03"
            onChange={(e) => setLength(e.target.value)}
            className="field py-1.5 tabular-nums"
          />
        </label>
      </div>
      <p className="text-muted">
        {t.fileLengthNote}
        {props.runtime ? ` ${t.runtime(props.runtime)}` : ""}
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <button className="btn px-3.5 pb-1.5 pt-2 text-base" disabled={props.pending}>
          {props.pending ? t.saving : t.save}
        </button>
        <button type="button" onClick={props.onCancel} className="text-sm font-bold underline underline-offset-4">
          {t.cancel}
        </button>
      </div>
    </form>
  );
}
