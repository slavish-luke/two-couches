"use client";

import { useId, useOptimistic, useState, useTransition } from "react";
import { Translatable } from "@/components/translate";
import { ChatIcon, CloseIcon, ReactionSticker } from "@/components/icons";
import { getMessages } from "@/lib/i18n";
import type { CommentRow } from "@/lib/together";
import {
  COMMENTS_SHOWN,
  MAX_COMMENT_LENGTH,
  REACTIONS,
  reactionGroups,
  timeAgo,
  type Reaction,
} from "@/lib/together-rules";
import { addComment, reactToComment, removeComment, type CommentTarget, type TogetherResult } from "./actions";

type Person = { id: string; name: string };

type Change =
  | { type: "add"; body: string; by: string }
  | { type: "remove"; id: string }
  | { type: "react"; id: string; by: string; kind: Reaction | null };

/**
 * A short thread on a list item or a watch night: comments (≤ 500 characters; the author can delete theirs)
 * with one sticker per person per comment. Changes show at once here and reach the other screen through
 * ListSync. `collapsed` starts it folded behind a "3 comments" button (night cards).
 */
export function CommentThread(props: {
  target: CommentTarget;
  comments: CommentRow[];
  me: Person;
  partner: Person | null;
  language: string;
  serverNow: number;
  collapsed?: boolean;
  /** The thread's heading, when it has one (the title page). */
  heading?: string;
}) {
  const { me, partner, language } = props;
  const t = getMessages(language);
  const text = t.together.comments;
  const kinds = t.nights.room.reactions.kinds;
  const [open, setOpen] = useState(!props.collapsed);
  const [showAll, setShowAll] = useState(false);
  const [draft, setDraft] = useState("");
  const [picking, setPicking] = useState<string | null>(null);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const threadId = useId();
  const [comments, change] = useOptimistic(props.comments, (comments: CommentRow[], c: Change) => {
    if (c.type === "add") {
      return [...comments, { id: `new-${comments.length}`, profile_id: c.by, body: c.body, created_at: new Date().toISOString(), reactions: [] }];
    }
    if (c.type === "remove") return comments.filter((comment) => comment.id !== c.id);
    return comments.map((comment) =>
      comment.id === c.id
        ? {
            ...comment,
            reactions: [
              ...comment.reactions.filter((r) => r.profile_id !== c.by),
              ...(c.kind ? [{ profile_id: c.by, kind: c.kind }] : []),
            ],
          }
        : comment,
    );
  });

  function run(optimistic: Change, action: () => Promise<TogetherResult>, onDone?: () => void) {
    setError(undefined);
    startTransition(async () => {
      change(optimistic);
      const result = await action();
      if (result.error) setError(result.error);
      else onDone?.();
    });
  }

  const nameOf = (id: string) => (id === me.id ? t.common.you : partner && id === partner.id ? partner.name : t.common.yourPartner);
  const hidden = showAll ? 0 : Math.max(0, comments.length - COMMENTS_SHOWN);
  const shown = comments.slice(hidden);

  if (!open) {
    return (
      <button
        type="button"
        aria-expanded={false}
        aria-controls={threadId}
        onClick={() => setOpen(true)}
        className="tap-area inline-flex items-center gap-1.5 justify-self-start text-sm font-bold underline underline-offset-4"
      >
        <ChatIcon className="size-4 shrink-0" />
        {text.toggle(comments.length)}
      </button>
    );
  }

  return (
    <div id={threadId} data-comments aria-busy={pending} className="grid gap-3">
      {props.heading ? (
        <h2 className="display text-[2rem]">{props.heading}</h2>
      ) : (
        props.collapsed && (
          <button
            type="button"
            aria-expanded
            aria-controls={threadId}
            onClick={() => setOpen(false)}
            className="tap-area inline-flex items-center gap-1.5 justify-self-start text-sm font-bold underline underline-offset-4"
          >
            <ChatIcon className="size-4 shrink-0" />
            {text.toggle(comments.length)}
          </button>
        )
      )}

      <div className={`grid gap-3 ${props.heading ? "card" : "paper rounded-control border-[3px] border-outline p-3"}`}>
        {hidden > 0 && (
          <button type="button" onClick={() => setShowAll(true)} className="tap-area justify-self-start text-sm font-bold underline underline-offset-4">
            {text.earlier(hidden)}
          </button>
        )}
        {comments.length === 0 && <p className="text-sm text-muted">{text.empty}</p>}
        {shown.length > 0 && (
          <ul className="grid gap-3">
            {shown.map((comment) => {
              const mine = comment.profile_id === me.id;
              const myReaction = comment.reactions.find((r) => r.profile_id === me.id)?.kind ?? null;
              const temporary = comment.id.startsWith("new-");
              return (
                <li key={comment.id} data-comment className="grid min-w-0 gap-1">
                  <div className="flex min-w-0 items-baseline gap-1.5 text-sm">
                    <span aria-hidden className={`size-2.5 shrink-0 self-center rounded-full border-2 border-outline ${mine ? "bg-me" : "bg-partner"}`} />
                    <span className="truncate font-bold">{nameOf(comment.profile_id)}</span>
                    <span className="shrink-0 text-muted">· {timeAgo(comment.created_at, props.serverNow, language)}</span>
                    {mine && !temporary && (
                      <button
                        type="button"
                        aria-label={text.remove(comment.body.slice(0, 40))}
                        onClick={() => run({ type: "remove", id: comment.id }, () => removeComment(comment.id))}
                        className="tap-area ml-auto grid size-6 shrink-0 place-items-center self-center rounded-full text-muted transition hover:bg-current/10 hover:text-ink"
                      >
                        <CloseIcon className="size-3.5 [stroke-width:2.75]" />
                      </button>
                    )}
                  </div>
                  {mine ? (
                    <p className="whitespace-pre-line font-medium [overflow-wrap:anywhere]">{comment.body}</p>
                  ) : (
                    // Sprint 21: your partner's words, in your language if you like.
                    <Translatable text={comment.body} language={language}>
                      {(shown) => <p className="whitespace-pre-line font-medium [overflow-wrap:anywhere]">{shown}</p>}
                    </Translatable>
                  )}
                  {!temporary && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      {reactionGroups(comment.reactions).map(({ kind, by }) => {
                        const label = text.reactedBy(kinds[kind], by.map(nameOf).join(", "));
                        const face = (
                          <>
                            <ReactionSticker kind={kind} className="size-5" />
                            {by.map((id) => (
                              <span key={id} aria-hidden className={`size-2 rounded-full border-[1.5px] border-outline ${id === me.id ? "bg-me" : "bg-partner"}`} />
                            ))}
                          </>
                        );
                        // Yours can be taken back with a tap; theirs is just shown.
                        return by.includes(me.id) ? (
                          <button
                            key={kind}
                            type="button"
                            aria-pressed
                            aria-label={text.takeBack(kinds[kind])}
                            title={label}
                            onClick={() =>
                              run({ type: "react", id: comment.id, by: me.id, kind: null }, () => reactToComment(comment.id, null))
                            }
                            className="chip gap-1 px-1.5 py-0.5"
                          >
                            {face}
                          </button>
                        ) : (
                          <span key={kind} role="img" aria-label={label} title={label} className="chip pointer-events-none gap-1 px-1.5 py-0.5">
                            {face}
                          </span>
                        );
                      })}
                      <button
                        type="button"
                        aria-expanded={picking === comment.id}
                        aria-label={mine ? text.reactToYours : text.reactTo(nameOf(comment.profile_id))}
                        onClick={() => setPicking((p) => (p === comment.id ? null : comment.id))}
                        className="tap-area grid size-7 place-items-center rounded-full text-muted transition hover:bg-current/10 hover:text-ink"
                      >
                        <AddReactionIcon />
                      </button>
                      {picking === comment.id && (
                        <span role="group" aria-label={text.react} className="flex flex-wrap gap-0.5">
                          {REACTIONS.map((kind) => (
                            <button
                              key={kind}
                              type="button"
                              aria-pressed={myReaction === kind}
                              aria-label={kinds[kind]}
                              title={kinds[kind]}
                              onClick={() => {
                                const next = myReaction === kind ? null : kind;
                                setPicking(null);
                                run({ type: "react", id: comment.id, by: me.id, kind: next }, () => reactToComment(comment.id, next));
                              }}
                              className="grid size-8 place-items-center rounded-full transition hover:bg-current/10 aria-pressed:bg-accent-soft"
                            >
                              <ReactionSticker kind={kind} className="size-6" />
                            </button>
                          ))}
                        </span>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        <form
          className="grid gap-1.5"
          onSubmit={(e) => {
            e.preventDefault();
            const body = draft.trim();
            if (!body) return;
            run({ type: "add", body, by: me.id }, () => addComment(props.target, body), () => setDraft(""));
          }}
        >
          <div className="flex items-end gap-2">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                // Enter sends; Shift+Enter starts a new line.
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  e.currentTarget.form?.requestSubmit();
                }
              }}
              maxLength={MAX_COMMENT_LENGTH}
              rows={1}
              aria-label={text.placeholder}
              placeholder={text.placeholder}
              className="field min-h-10 min-w-0 flex-1 resize-y py-1.5 text-[15px] [field-sizing:content]"
            />
            <button disabled={pending || !draft.trim()} className="btn-quiet shrink-0 px-3 py-1.5 text-sm">
              {text.send}
            </button>
          </div>
          {draft.length > MAX_COMMENT_LENGTH - 80 && (
            <span aria-hidden className="text-xs font-semibold text-muted">
              {text.count(draft.length, MAX_COMMENT_LENGTH)}
            </span>
          )}
        </form>
        {error && (
          <p role="alert" className="text-sm font-semibold text-danger">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}

/** A smiling face with a plus: add a reaction. */
function AddReactionIcon() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="size-5">
      <path d="M20.5 11.5A8.5 8.5 0 1 1 12.5 3" />
      <path d="M8.5 14.5q3.5 3 7 0M9 9.5v.5M15 9.5v.5M19 2.5v5M16.5 5h5" />
    </svg>
  );
}
