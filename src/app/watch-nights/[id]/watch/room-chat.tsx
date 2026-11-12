"use client";

import { useEffect, useId, useRef } from "react";
import { ChatIcon } from "@/components/icons";
import { getMessages } from "@/lib/i18n";
import { cleanChat, MAX_CHAT_LENGTH } from "@/lib/room-rules";

/** A chat message in the room: kept in memory on the two screens only. `at` is when it arrived here. */
export type ChatMessage = { id: string; by: string; text: string; at: number };

/**
 * The watch room's chat: beside the video (below it on phones), or beside the picture in full screen.
 * Enter sends. Collapsed, its toggle carries a sticker with the number of unread messages.
 */
export function RoomChat({
  language,
  meId,
  names,
  messages,
  draft,
  onDraft,
  onSend,
  open,
  onToggle,
  unread,
  live,
  fill = false,
}: {
  language: string;
  meId: string;
  names: { me: string; partner: string };
  messages: ChatMessage[];
  draft: string;
  onDraft: (text: string) => void;
  onSend: () => void;
  open: boolean;
  onToggle: () => void;
  unread: number;
  live: boolean;
  /** Full screen: fill the height beside the picture. */
  fill?: boolean;
}) {
  const text = getMessages(language).nights.room.chat;
  const id = useId();
  const log = useRef<HTMLOListElement>(null);
  // Times keep the plain language (12-hour English), like the rest of the app.
  const time = new Intl.DateTimeFormat(language, { hour: "numeric", minute: "2-digit" });

  // Keep the newest message in view.
  useEffect(() => {
    const el = log.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, open]);

  return (
    <section
      data-room-chat
      aria-labelledby={`${id}-heading`}
      className={`card grid content-start gap-3 p-4 text-sm ${fill && open ? "h-full min-h-0 grid-rows-[auto_minmax(0,1fr)_auto]" : ""}`}
    >
      <div className="flex items-center justify-between gap-2">
        <h2 id={`${id}-heading`} className="flex items-center gap-2 text-base font-bold">
          <ChatIcon className="size-5" />
          {text.heading}
        </h2>
        <button type="button" onClick={onToggle} aria-expanded={open} aria-controls={`${id}-body`} className="btn-quiet relative px-2.5 py-1 text-sm">
          {open ? text.hide : text.show}
          {unread > 0 && (
            <span className="absolute -right-2.5 -top-2.5 grid h-6 min-w-6 place-items-center rounded-full border-2 border-outline bg-accent px-1 text-xs font-bold text-on-accent">
              <span aria-hidden>{unread}</span>
              <span className="sr-only">{text.unread(unread)}</span>
            </span>
          )}
        </button>
      </div>

      {open && (
        <>
          <ol
            id={`${id}-body`}
            ref={log}
            role="log"
            aria-live="polite"
            aria-labelledby={`${id}-heading`}
            className={`grid content-start gap-2 overflow-y-auto overscroll-contain pr-1 ${fill ? "min-h-0" : "max-h-64"}`}
          >
            {messages.length === 0 ? (
              <li className="text-muted">{text.empty}</li>
            ) : (
              messages.map((m) => {
                const mine = m.by === meId;
                return (
                  <li key={m.id} className="text-[15px] leading-snug break-words">
                    <span
                      className={`mr-1.5 inline-block max-w-[9rem] truncate rounded-full border-2 border-outline px-2 align-[0.05em] text-xs font-bold ${mine ? "bg-me" : "bg-partner"}`}
                    >
                      {mine ? names.me : names.partner}
                    </span>
                    {m.text}
                    <time className="ml-1.5 text-xs text-muted" dateTime={new Date(m.at).toISOString()}>
                      {time.format(m.at)}
                    </time>
                  </li>
                );
              })
            )}
          </ol>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (live && cleanChat(draft)) onSend();
            }}
          >
            <label htmlFor={`${id}-input`} className="sr-only">
              {text.label}
            </label>
            <input
              id={`${id}-input`}
              className="field min-w-0 flex-1 py-1.5"
              value={draft}
              onChange={(e) => onDraft(e.target.value)}
              maxLength={MAX_CHAT_LENGTH}
              placeholder={text.placeholder}
              autoComplete="off"
              enterKeyHint="send"
            />
            <button type="submit" className="btn-quiet" disabled={!live || !cleanChat(draft)}>
              {text.send}
            </button>
          </form>
        </>
      )}
    </section>
  );
}
