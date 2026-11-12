"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { SendIcon } from "@/components/icons";
import { getMessages } from "@/lib/i18n";
import { MAX_SEND_NOTE } from "@/lib/shelf-rules";
import type { TitleRef } from "@/lib/watch";
import { sendTitle, takeBackSend } from "./shelf-actions";

/**
 * "Send to {name}": opens a small dialog for an optional note, then sends the title to your partner (a push,
 * and a card on their Home). While it waits for their answer it says so, with "Take it back".
 * `compact` is the search results' text link.
 */
export function SendTitle({
  titleRef,
  title,
  partnerName,
  language,
  waiting,
  compact = false,
}: {
  titleRef: TitleRef;
  title: string;
  partnerName: string;
  language: string;
  /** Your send of this title that your partner hasn't answered yet. */
  waiting: { id: string } | null;
  compact?: boolean;
}) {
  const t = getMessages(language).shelf.send;
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const [sentHere, setSentHere] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const id = useId();

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  const sent = waiting !== null || sentHere;
  const size = compact ? "text-sm" : "text-[15px]";

  if (sent) {
    return (
      <span data-send-title className={`flex flex-wrap items-center gap-x-3 gap-y-1 ${size}`}>
        <span className="inline-flex items-center gap-1.5 font-semibold text-muted">
          <SendIcon className="size-4" />
          {t.sent(partnerName)}
        </span>
        {waiting && (
          <button
            type="button"
            disabled={pending}
            className="tap-area font-bold underline underline-offset-4 disabled:opacity-60"
            onClick={() =>
              startTransition(async () => {
                const result = await takeBackSend(waiting.id);
                setError(result.error);
                if (!result.error) setSentHere(false);
              })
            }
          >
            {t.takeBack}
          </button>
        )}
        {error && (
          <span role="alert" className="text-xs font-semibold text-danger">
            {error}
          </span>
        )}
      </span>
    );
  }

  return (
    <>
      <button
        type="button"
        data-send-title
        onClick={() => {
          setError(undefined);
          setOpen(true);
        }}
        className={compact ? "tap-area inline-flex items-center gap-1 text-sm font-bold underline underline-offset-4" : "btn-quiet"}
      >
        <SendIcon className="size-4" />
        {t.button(partnerName)}
      </button>
      <dialog ref={dialog} aria-labelledby={`${id}-heading`} className="send-dialog" onClose={() => setOpen(false)}>
        {open && (
          <form
            className="card grid gap-4 p-5 sm:p-6"
            aria-busy={pending}
            onSubmit={(e) => {
              e.preventDefault();
              setError(undefined);
              startTransition(async () => {
                const result = await sendTitle(titleRef, note);
                if (result.error) return setError(result.error);
                setNote("");
                setSentHere(true);
                setOpen(false);
              });
            }}
          >
            <div className="grid gap-1">
              <h2 id={`${id}-heading`} className="display-ink text-[1.6rem] leading-none">
                {t.heading(partnerName)}
              </h2>
              <p className="text-lg font-bold leading-tight [overflow-wrap:anywhere]">{title}</p>
            </div>
            <label className="grid gap-1.5">
              <span className="flex items-baseline justify-between gap-2">
                <span className="font-bold">
                  {t.noteLabel} <span className="font-semibold text-muted">({t.optional})</span>
                </span>
                <span className="text-xs font-semibold text-muted" aria-hidden>
                  {t.count(note.length, MAX_SEND_NOTE)}
                </span>
              </span>
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={MAX_SEND_NOTE}
                placeholder={t.notePlaceholder}
                autoFocus
                className="field"
              />
            </label>
            {error && (
              <p role="alert" className="text-sm font-semibold text-danger">
                {error}
              </p>
            )}
            <div className="flex flex-wrap gap-2.5">
              <button className="btn" disabled={pending}>
                <SendIcon className="size-4" />
                {pending ? t.sending : t.send}
              </button>
              <button type="button" className="btn-quiet" onClick={() => setOpen(false)}>
                {t.cancel}
              </button>
            </div>
          </form>
        )}
      </dialog>
    </>
  );
}
