"use client";

import { useLayoutEffect, useRef, useState, useTransition, type CSSProperties, type ReactNode } from "react";
import { Couch, Couches } from "@/components/couch";
import { FilePick, VIDEO_TYPES } from "@/components/file-pick";
import { CheckIcon } from "@/components/icons";
import { spring } from "@/lib/couch-moves";
import { confetti, flare, sfx, sparkles } from "@/lib/fx";
import { amp, anim, center, isCalm, isReduced, isWild, SPRING, wait } from "@/lib/motion";
import { getMessages } from "@/lib/i18n";
import { probeFile, type MediaProblem } from "@/lib/media-check";
import type { NightMethod } from "@/lib/night-rules";
import { dateLocale } from "@/lib/places";
import {
  bothReady,
  cleanFileName,
  compareLengths,
  formatLength,
  labelFromFileName,
  lengthForInput,
  MAX_FILE_LABEL_LENGTH,
  usesOwnFiles,
  type ReadyCheck as Check,
} from "@/lib/ready-rules";
import { compareFiles, formatSize } from "@/lib/room-rules";
import { saveFile, setReady, type FileInput, type NightResult } from "./actions";

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
  // Chosen files (Sprint 23) also compare by name and size, as in the watch room.
  const sameFile =
    files && mine && theirs
      ? compareFiles(
          { seconds: mine.file_seconds, name: mine.file_name, size: mine.file_size },
          { seconds: theirs.file_seconds, name: theirs.file_name, size: theirs.file_size },
        )
      : null;
  const room = getMessages(language).nights.room;

  // Sprint 27 (the motion lab's "ready" scene): someone becoming ready while you look springs their couch and
  // draws their tick; both becoming ready scoots the couches together behind the tag, with sparkles, the
  // ground's flare and, at Wild, confetti from both sides. Nothing on the first render.
  const rootRef = useRef<HTMLDivElement>(null);
  const wasReady = useRef<{ me: boolean; partner: boolean; both: boolean } | null>(null);
  const meReady = Boolean(mine?.ready_at);
  const partnerReady = Boolean(theirs?.ready_at);
  // A layout effect, so a tick that's about to draw itself never shows whole for a frame first.
  useLayoutEffect(() => {
    const before = wasReady.current;
    wasReady.current = { me: meReady, partner: partnerReady, both };
    const root = rootRef.current;
    if (!before || !root || document.hidden) return;
    if (meReady && !before.me) void becomeReady(root, "me");
    if (partnerReady && !before.partner) void becomeReady(root, "partner");
    if (both && !before.both) void celebrate(root);
  }, [meReady, partnerReady, both]);

  function run(action: () => Promise<NightResult>, after?: () => void) {
    setError(undefined);
    startTransition(async () => {
      const result = await action();
      if (result.error) setError(result.error);
      else after?.();
    });
  }

  const textButton =
    "tap-area text-sm font-bold underline underline-offset-4 transition hover:decoration-[3px] disabled:opacity-50";

  // A paper slip of its own, so it reads the same on a card and inside the home page's grape spotlight.
  return (
    <div
      ref={rootRef}
      aria-busy={pending}
      data-ready-check
      className={`paper grid gap-2.5 rounded-control border-[3px] border-outline p-3 text-sm transition-colors duration-500 ${both ? "bg-both-soft" : ""}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
        <span className="text-base font-bold">{t.heading}</span>
        {both && (
          // You're both ready: the two couches turn up, and a bubblegum tag pops in like the BOTH burst.
          <span className="inline-flex items-center gap-2">
            <Couches size={34} className="ready-couches" />
            <span
              style={{ "--r": "-3deg", rotate: "var(--r)" } as CSSProperties}
              className="burst inline-flex items-center gap-1.5 rounded-full border-[2.5px] border-outline bg-stamp px-3 pb-0.5 pt-1 font-display text-base uppercase leading-none tracking-[0.03em] text-on-stamp shadow-[var(--lift-sm)_var(--lift-sm)_0_var(--outline)]"
            >
              <CheckIcon className="size-4 [stroke-width:3]" />
              {t.bothReady}
            </span>
          </span>
        )}
      </div>

      <ul className="grid gap-2">
        <Row person={me} who="me" check={mine} fill="bg-me" files={files} language={language}>
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
        {partner && <Row person={partner} who="partner" check={theirs} fill="bg-partner" files={files} language={language} />}
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
      {sameFile === "same" && <p className="font-semibold">{room.file.same}</p>}
      {sameFile === "differentName" && <p className="font-semibold">{room.file.differentName}</p>}
      {sameFile === "differentSize" && (
        <p className="font-semibold text-danger">
          {room.file.differentSize(formatSize(mine!.file_size!, dateLocale(language)), formatSize(theirs!.file_size!, dateLocale(language)))}
        </p>
      )}

      {editing && (
        <FileForm
          // Start from what's saved, including a change that arrived from another screen.
          key={`${mine?.file_label}:${mine?.file_seconds}:${mine?.file_name}:${mine?.file_size}`}
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

/** Someone's couch springs up and their tick draws itself (Calm: a smaller spring; reduced motion: neither). */
async function becomeReady(root: HTMLElement, who: "me" | "partner") {
  if (isReduced()) return;
  const row = root.querySelector(`[data-seat="${who}"]`);
  const couch = row?.querySelector(".couch");
  if (couch) void spring(couch, isCalm());
  const tick = row?.closest("li")?.querySelector<SVGPathElement>("[data-tick] path");
  if (!tick) return;
  tick.style.strokeDashoffset = "1";
  await wait(300);
  await anim(tick, [{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { duration: 300, easing: "ease-out" }).finished;
  tick.style.strokeDashoffset = "";
}

/** You're both ready: the couches scoot in from each side behind the tag, then sparkles, flare and (Wild) confetti. */
async function celebrate(root: HTMLElement) {
  if (isReduced()) return;
  await wait(350);
  const couches = [...root.querySelectorAll<SVGElement>(".ready-couches .couch")];
  const tag = root.querySelector(".ready-couches")?.nextElementSibling;
  const scoot = isCalm() ? 0 : 22 * amp();
  couches.forEach((couch, i) => {
    void anim(couch, [{ translate: `${i ? scoot : -scoot}px 0` }, { translate: "0 0" }], { duration: 450, easing: SPRING, delay: i * 60 });
  });
  await wait(400);
  if (!tag) return;
  const c = center(tag);
  sparkles(c.x, c.y, { count: 14, distance: 100 });
  sfx("ready", c.x, c.y - 80);
  flare();
  if (isWild()) {
    confetti(c.x, c.y, { toward: 1, count: 14, color: "var(--me)", meetColor: "var(--stamp)" });
    confetti(c.x, c.y, { toward: -1, count: 14, color: "var(--partner)", meetColor: "var(--stamp)" });
  }
}

/** One person: their couch, name tag, ready or not, the file they have, and (for you) the buttons. */
function Row(props: {
  person: Person;
  who: "me" | "partner";
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
  const chosen = check?.file_name
    ? [check.file_name, check.file_size ? formatSize(check.file_size, dateLocale(props.language)) : null].filter(Boolean).join(" · ")
    : null;
  return (
    <li className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
      {/* Their seat: a little couch that springs up when they're ready. */}
      <span data-seat={props.who} className="-my-1 inline-flex">
        <Couch who={props.who} size={28} />
      </span>
      <span
        className={`max-w-full truncate rounded-full border-[2.5px] border-outline px-2.5 text-sm font-bold ${props.fill}`}
      >
        {props.person.name}
      </span>
      {check?.ready_at ? (
        <span className="inline-flex items-center gap-1 rounded-full border-2 border-outline bg-accent py-px pl-1.5 pr-2.5 text-sm font-bold text-on-accent">
          {/* The check, drawn with pathLength 1 so it can draw itself in (becomeReady()). */}
          <svg data-tick aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" className="inline-block size-4 shrink-0">
            <path pathLength={1} strokeDasharray={1} d="m5 12.5 4.5 4.5L19 7.5" />
          </svg>
          {t.ready}
        </span>
      ) : (
        <span className="font-semibold text-muted">{t.notYet}</span>
      )}
      {props.files && <span className="text-muted [overflow-wrap:anywhere]">{file || t.noFile}</span>}
      {props.files && chosen && (
        <span className="w-full truncate text-muted" title={chosen}>
          {chosen}
        </span>
      )}
      {props.children}
    </li>
  );
}

/** The file you chose, as read in this browser: its name and size, and anything that stops it playing here. */
type Chosen = { name: string | null; size: number | null; problem: MediaProblem | null; checked: boolean };

/**
 * Your file's version and length: typed, or read from the file itself ("Choose your file": its length,
 * name and size, and whether this browser can play it, all worked out on this device).
 */
function FileForm(props: {
  check: Check | undefined;
  runtime: number | null;
  pending: boolean;
  language: string;
  onCancel: () => void;
  onSave: (input: FileInput) => void;
}) {
  const messages = getMessages(props.language).nights;
  const t = messages.ready;
  const [label, setLabel] = useState(props.check?.file_label ?? "");
  const [length, setLength] = useState(props.check?.file_seconds ? lengthForInput(props.check.file_seconds) : "");
  const [chosen, setChosen] = useState<Chosen | null>(
    props.check?.file_name || props.check?.file_size
      ? { name: props.check.file_name, size: props.check.file_size, problem: null, checked: false }
      : null,
  );
  /** The label last filled in from a file's name: replaced by the next file's, unless you've changed it. */
  const [autoLabel, setAutoLabel] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const [noLength, setNoLength] = useState(false);
  /** Which file is being read, so a slow one picked first can't overwrite a quicker second pick. */
  const reads = useRef(0);

  async function read(file: File) {
    const id = (reads.current += 1);
    setReading(true);
    setNoLength(false);
    const result = await probeFile(file);
    if (id !== reads.current) return;
    setReading(false);
    setChosen({ name: cleanFileName(file.name), size: file.size, problem: result.problem, checked: true });
    if (result.seconds) setLength(lengthForInput(result.seconds));
    else setNoLength(true);
    // Start the version from the file's name, unless you've written one of your own.
    const fromName = labelFromFileName(file.name);
    if (!label.trim() || label === autoLabel) {
      setLabel(fromName);
      setAutoLabel(fromName);
    }
  }

  return (
    <form
      className="grid gap-3 border-t-2 border-outline/15 pt-3"
      onSubmit={(e) => {
        e.preventDefault();
        props.onSave({ label, length, name: chosen?.name ?? null, size: chosen?.size ?? null });
      }}
    >
      <div data-file-read className="grid justify-items-start gap-1.5">
        <FilePick accept={VIDEO_TYPES} onFile={(f) => void read(f)} disabled={reading || props.pending} className="btn-quiet">
          {reading ? t.reading : t.chooseFile}
        </FilePick>
        <p className="text-muted">{t.chooseNote}</p>
        {chosen && (chosen.name || chosen.size) && (
          <p className="flex max-w-full flex-wrap items-center gap-x-3 gap-y-1">
            <span className="min-w-0 max-w-full truncate font-semibold" title={chosen.name ?? undefined}>
              {[chosen.name, chosen.size ? formatSize(chosen.size, dateLocale(props.language)) : null].filter(Boolean).join(" · ")}
            </span>
            <button type="button" onClick={() => setChosen(null)} className="tap-area text-sm font-bold underline underline-offset-4">
              {t.forgetFile}
            </button>
          </p>
        )}
        {chosen?.checked &&
          (chosen.problem ? (
            <p role="alert" className="font-semibold text-danger">
              {messages.room.problems[chosen.problem]}
            </p>
          ) : (
            <p className="flex items-start gap-2 font-semibold">
              <span
                aria-hidden
                className="mt-px grid size-5 shrink-0 place-items-center rounded-full border-2 border-outline bg-accent text-on-accent"
              >
                <CheckIcon className="size-3 [stroke-width:3.5]" />
              </span>
              {t.playsHere}
            </p>
          ))}
        {noLength && <p className="font-semibold">{t.noLength}</p>}
      </div>
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
        <button className="btn px-3.5 pb-1.5 pt-2 text-base" disabled={props.pending || reading}>
          {props.pending ? t.saving : t.save}
        </button>
        <button type="button" onClick={props.onCancel} className="tap-area text-sm font-bold underline underline-offset-4">
          {t.cancel}
        </button>
      </div>
    </form>
  );
}
