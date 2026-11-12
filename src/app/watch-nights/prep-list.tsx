"use client";

import { useOptimistic, useState, useTransition } from "react";
import { CheckIcon, CloseIcon, PlusIcon } from "@/components/icons";
import { getMessages } from "@/lib/i18n";
import type { NightMethod } from "@/lib/night-rules";
import type { PrepItem } from "@/lib/nights";
import { MAX_PREP_ITEMS, MAX_PREP_LABEL_LENGTH, prepIdeas } from "@/lib/planning-rules";
import { addPrepItem, removePrepItem, setPrepDone, type NightResult } from "./actions";

type Person = { id: string; name: string };

type Change =
  | { type: "add"; label: string; by: string }
  | { type: "tick"; id: string; done: boolean; by: string }
  | { type: "remove"; id: string };

/** How many ideas to offer at once. */
const IDEAS_SHOWN = 3;

/**
 * A night's shared prep checklist: tick, add (or take an idea), remove. Either of you can change anything;
 * changes show at once here and arrive on the other screen through ListSync.
 */
export function PrepList(props: {
  nightId: string;
  items: PrepItem[];
  method: NightMethod | null;
  me: Person;
  partner: Person | null;
  language: string;
}) {
  const { me, partner, language } = props;
  const t = getMessages(language).nights.prep;
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  const [draft, setDraft] = useState("");
  const [adding, setAdding] = useState(false);
  const [items, change] = useOptimistic(props.items, (items: PrepItem[], c: Change) => {
    if (c.type === "add") {
      const now = new Date().toISOString();
      return [...items, { id: `new-${c.label}`, label: c.label, done_at: null, done_by: null, added_by: c.by, created_at: now }];
    }
    if (c.type === "remove") return items.filter((item) => item.id !== c.id);
    return items.map((item) =>
      item.id === c.id ? { ...item, done_at: c.done ? new Date().toISOString() : null, done_by: c.done ? c.by : null } : item,
    );
  });

  function run(optimistic: Change, action: () => Promise<NightResult>, onDone?: () => void) {
    setError(undefined);
    startTransition(async () => {
      change(optimistic);
      const result = await action();
      if (result.error) setError(result.error);
      else onDone?.();
    });
  }

  function add(label: string, onDone?: () => void) {
    const clean = label.replace(/\s+/g, " ").trim();
    if (!clean) return;
    run({ type: "add", label: clean, by: me.id }, () => addPrepItem(props.nightId, clean), onDone);
  }

  const done = items.filter((item) => item.done_at).length;
  const onList = new Set(items.map((item) => item.label.toLocaleLowerCase(language)));
  const ideas = prepIdeas(props.method)
    .map((key) => t.ideas[key])
    .filter((label) => !onList.has(label.toLocaleLowerCase(language)))
    .slice(0, IDEAS_SHOWN);
  const full = items.length >= MAX_PREP_ITEMS;
  const showForm = items.length > 0 || adding;
  const nameOf = (id: string | null) => (id === me.id ? me : partner && id === partner.id ? partner : null);

  // A paper slip of its own, like the ready check, so it reads the same on a card and in the spotlight.
  return (
    <div data-prep aria-busy={pending} className="paper grid gap-2.5 rounded-control border-[3px] border-outline p-3 text-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <span className="text-base font-bold">{t.heading}</span>
        {items.length > 0 && <span className="font-semibold text-muted">{t.count(done, items.length)}</span>}
      </div>

      {items.length > 0 && (
        <ul className="grid gap-1">
          {items.map((item) => {
            const ticked = Boolean(item.done_at);
            const by = nameOf(item.done_by);
            return (
              <li key={item.id} className="flex min-w-0 items-center gap-2">
                <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 py-0.5">
                  <input
                    type="checkbox"
                    checked={ticked}
                    disabled={item.id.startsWith("new-")}
                    onChange={(e) => {
                      const next = e.target.checked;
                      run({ type: "tick", id: item.id, done: next, by: me.id }, () => setPrepDone(item.id, next));
                    }}
                    className="peer sr-only"
                  />
                  <span
                    aria-hidden
                    className="grid size-5 shrink-0 place-items-center rounded-[7px] border-[2.5px] border-outline bg-surface text-transparent transition duration-150 ease-(--ease-spring) peer-checked:-rotate-6 peer-checked:bg-accent peer-checked:text-on-accent peer-focus-visible:outline-[3px] peer-focus-visible:outline-offset-2 peer-focus-visible:outline-(--focus) peer-focus-visible:outline-solid"
                  >
                    <CheckIcon className="size-3.5 [stroke-width:3.5]" />
                  </span>
                  <span className="min-w-0 font-semibold [overflow-wrap:anywhere] peer-checked:text-muted peer-checked:line-through peer-checked:decoration-2">
                    {item.label}
                  </span>
                </label>
                {ticked && by && (
                  <span
                    role="img"
                    aria-label={t.tickedBy(by.id === me.id ? getMessages(language).common.you : by.name)}
                    title={t.tickedBy(by.id === me.id ? getMessages(language).common.you : by.name)}
                    className={`size-2.5 shrink-0 rounded-full border-2 border-outline ${by.id === me.id ? "bg-me" : "bg-partner"}`}
                  />
                )}
                <button
                  type="button"
                  disabled={pending || item.id.startsWith("new-")}
                  aria-label={t.remove(item.label)}
                  onClick={() => run({ type: "remove", id: item.id }, () => removePrepItem(item.id))}
                  className="tap-area grid size-6 shrink-0 place-items-center rounded-full text-muted transition hover:bg-current/10 hover:text-ink disabled:opacity-40"
                >
                  <CloseIcon className="size-4 [stroke-width:2.75]" />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {!full && showForm && (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            add(draft, () => setDraft(""));
          }}
        >
          <input
            // Opened from "Something else", so the cursor goes straight in.
            autoFocus={adding && items.length === 0}
            value={draft}
            maxLength={MAX_PREP_LABEL_LENGTH}
            aria-label={t.addLabel}
            placeholder={t.placeholder}
            onChange={(e) => setDraft(e.target.value)}
            className="field min-w-0 flex-1 py-1 text-[15px]"
          />
          <button disabled={pending || !draft.trim()} className="btn-quiet shrink-0 px-3 text-sm">
            {t.add}
          </button>
        </form>
      )}

      {!full && (ideas.length > 0 || !showForm) && (
        <div className="flex flex-wrap items-center gap-1.5">
          {ideas.map((label) => (
            <button
              key={label}
              type="button"
              disabled={pending}
              aria-label={t.addIdea(label)}
              onClick={() => add(label)}
              className="chip gap-1 px-2.5 py-0.5 text-[13px]"
            >
              <PlusIcon className="size-3.5 [stroke-width:3]" />
              {label}
            </button>
          ))}
          {/* An empty list stays one row: your own thing opens the field. */}
          {!showForm && (
            <button type="button" onClick={() => setAdding(true)} className="chip gap-1 px-2.5 py-0.5 text-[13px]">
              <PlusIcon className="size-3.5 [stroke-width:3]" />
              {t.own}
            </button>
          )}
        </div>
      )}

      {error && (
        <p role="alert" className="font-semibold text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
