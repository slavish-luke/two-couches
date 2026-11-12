"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { CloseIcon, PlusIcon, SendIcon, ShelfIcon } from "@/components/icons";
import { Poster } from "@/components/poster";
import { Translatable } from "@/components/translate";
import { getMessages } from "@/lib/i18n";
import type { SendAnswer } from "@/lib/shelf-rules";
import { titleHref, type TitleRef } from "@/lib/watch";
import { answerSend } from "./shelf-actions";

/**
 * A title your partner sent you, with their note: add it to Up next, keep it for someday, or wave it off.
 * On Home (with the poster and a link to the title) and on the title page itself (`onTitlePage`).
 */
export function SentCard({
  send,
  partnerName,
  language,
  onTitlePage = false,
}: {
  send: TitleRef & { id: string; note: string; title: string; poster_path: string | null };
  partnerName: string;
  language: string;
  onTitlePage?: boolean;
}) {
  const t = getMessages(language).shelf.send;
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  const [done, setDone] = useState<SendAnswer | null>(null);

  function answer(choice: SendAnswer) {
    setError(undefined);
    startTransition(async () => {
      const result = await answerSend(send.id, choice);
      if (result.error) setError(result.error);
      else setDone(choice);
    });
  }

  if (done) {
    return (
      <p role="status" className="paper rounded-control border-[3px] border-outline px-3 py-2.5 font-semibold">
        {t.answered[done](partnerName)}
      </p>
    );
  }

  return (
    <article data-sent-card className="card grid grid-cols-[auto_minmax(0,1fr)] gap-x-3.5 gap-y-3 p-3 sm:p-4" aria-busy={pending}>
      {!onTitlePage && (
        <Link href={titleHref(send)} tabIndex={-1} aria-hidden className="poster-frame block w-14 self-start sm:w-16">
          <Poster path={send.poster_path} title={send.title} size="sm" language={language} className="w-full" />
        </Link>
      )}
      <div className={`grid min-w-0 content-start gap-1.5 ${onTitlePage ? "col-span-2" : ""}`}>
        <span className="flex max-w-full items-center gap-1.5 justify-self-start rounded-full border-[2.5px] border-outline bg-partner px-2.5 text-sm font-bold">
          <SendIcon className="size-3.5 shrink-0" />
          <span className="truncate">{t.from(partnerName)}</span>
        </span>
        {!onTitlePage && (
          <Link href={titleHref(send)} className="text-lg font-bold leading-tight hover:underline [overflow-wrap:anywhere]">
            {send.title}
          </Link>
        )}
        {send.note && (
          <Translatable text={send.note} language={language}>
            {(shown) => (
              <blockquote className="max-w-prose font-medium [overflow-wrap:anywhere]">
                <span aria-hidden>“</span>
                {shown}
                <span aria-hidden>”</span>
              </blockquote>
            )}
          </Translatable>
        )}
      </div>
      <div className="col-span-2 flex flex-wrap gap-2">
        <button type="button" className="btn px-3 py-1 text-sm" disabled={pending} onClick={() => answer("added")}>
          <PlusIcon className="size-3.5" />
          {t.add}
        </button>
        <button type="button" className="btn-quiet px-3 py-1 text-sm" disabled={pending} onClick={() => answer("shelved")}>
          <ShelfIcon className="size-4" />
          {t.shelve}
        </button>
        <button type="button" className="btn-quiet px-3 py-1 text-sm" disabled={pending} onClick={() => answer("waved")}>
          <CloseIcon className="size-3.5" />
          {t.wave}
        </button>
      </div>
      {error && (
        <p role="alert" className="col-span-2 text-sm font-semibold text-danger">
          {error}
        </p>
      )}
    </article>
  );
}
