"use client";

import { useState, useTransition, type CSSProperties } from "react";
import { ReviewSection } from "@/app/after-night/review-box";
import { addToList, rateListItem, removeFromList, updateListItem, type ListChanges, type ListResult } from "@/app/list/actions";
import { PlusIcon, StarIcon } from "@/components/icons";
import { Stars } from "@/components/stars";
import { NameTag } from "@/components/name-tag";
import { getMessages, type Messages } from "@/lib/i18n";
import { cleanCategories, formatDate, LIST_STATUSES, localDate, MAX_CATEGORY_LENGTH, MAX_NOTES_LENGTH } from "@/lib/list-rules";
import type { ListItem } from "@/lib/list";
import type { Reviews } from "@/lib/review-rules";
import type { TitleRef } from "@/lib/watch";

type Person = { id: string; name: string };

type Props = {
  titleRef: TitleRef;
  /** Number of seasons, for series when TMDB knows it. */
  seasons: number | null;
  item: ListItem | null;
  /** Every category the couple uses. */
  categories: string[];
  me: Person;
  partner: Person | null;
  language: string;
  timeZone: string;
  /** Your review and what you may see of your partner's, when it's on the list. */
  reviews?: Reviews | null;
};

/** Status radios as chips (`.chip` shows aria-checked as selected). */
const RADIO_CHIP = "chip disabled:opacity-60";

/** "On our list" on a title page: add it, or change its status, progress, categories, note, ratings and reviews. */
export function ListPanel(props: Props) {
  const t = getMessages(props.language);
  return props.item ? <ListEditor {...props} item={props.item} t={t} /> : <AddToList titleRef={props.titleRef} t={t} />;
}

function useAction() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  function run(action: () => Promise<ListResult>, onDone?: () => void) {
    setError(undefined);
    startTransition(async () => {
      const result = await action();
      if (result.error) setError(result.error);
      else onDone?.();
    });
  }
  return { pending, error, run };
}

function AddToList({ titleRef, t }: { titleRef: TitleRef; t: Messages }) {
  const { pending, error, run } = useAction();
  const [note, setNote] = useState("");

  return (
    <section className="card grid gap-4">
      <h2 className="display-ink text-2xl">{t.title.panel.saveForLater}</h2>
      <form
        className="grid gap-3 sm:flex"
        onSubmit={(e) => {
          e.preventDefault();
          run(() => addToList(titleRef, note));
        }}
      >
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={MAX_NOTES_LENGTH}
          placeholder={t.title.panel.notePlaceholder}
          aria-label={t.title.panel.note}
          className="field"
        />
        <button className="btn shrink-0" disabled={pending}>
          {pending ? (
            t.common.add.adding
          ) : (
            <>
              <PlusIcon className="size-4" />
              {t.title.panel.addToList}
            </>
          )}
        </button>
      </form>
      {error && (
        <p role="alert" className="text-sm font-semibold text-danger">
          {error}
        </p>
      )}
    </section>
  );
}

function ListEditor(props: Props & { item: ListItem; t: Messages }) {
  const { item, seasons, categories, me, partner, language, titleRef, t } = props;
  const { pending, error, run } = useAction();
  const update = (changes: ListChanges, onDone?: () => void) => run(() => updateListItem(item.id, changes), onDone);
  const added = formatDate(localDate(props.timeZone, new Date(item.created_at)), language);
  const showRatings = item.status === "watched" || Object.keys(item.ratings).length > 0;

  return (
    <section className="card grid gap-6 sm:p-6" aria-busy={pending}>
      <div className="grid gap-1">
        <h2 className="display-ink text-[2rem]">{t.title.panel.onOurList}</h2>
        <p className="text-sm font-semibold text-muted">
          {item.added_by === me.id
            ? t.title.panel.addedByYou(added)
            : item.added_by === partner?.id
              ? t.title.panel.addedBy(partner.name, added)
              : t.title.panel.addedOn(added)}
        </p>
      </div>

      <div role="radiogroup" aria-label={t.title.panel.status} className="flex flex-wrap gap-2">
        {LIST_STATUSES.map((status) => (
          <button
            key={status}
            role="radio"
            aria-checked={item.status === status}
            disabled={pending}
            onClick={() => item.status !== status && update({ status })}
            className={RADIO_CHIP}
          >
            {t.common.statuses[status]}
          </button>
        ))}
      </div>

      {titleRef.media_type === "tv" && (
        <Progress item={item} seasons={seasons} pending={pending} update={update} t={t} />
      )}

      {item.status === "watched" && (
        <label className="flex flex-wrap items-center gap-3">
          <span className="font-bold">{t.title.panel.watchedOn}</span>
          <input
            key={item.watched_on}
            type="date"
            defaultValue={item.watched_on ?? ""}
            disabled={pending}
            onBlur={(e) => e.target.value !== (item.watched_on ?? "") && update({ watched_on: e.target.value || null })}
            className="field w-auto"
          />
        </label>
      )}

      {showRatings && (
        <div className="grid gap-2">
          <h3 className="text-lg font-bold">{t.title.panel.ratings}</h3>
          <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
            <StarPicker
              rating={item.ratings[me.id] ?? null}
              disabled={pending}
              onRate={(rating) => run(() => rateListItem(item.id, rating))}
              t={t}
            />
            {partner && (
              <span className="flex flex-wrap items-center gap-2">
                <NameTag name={partner.name} who="partner" />
                {item.ratings[partner.id] ? (
                  <span className="text-2xl leading-none">
                    <Stars rating={item.ratings[partner.id]} who={partner.name} language={language} />
                  </span>
                ) : (
                  <span className="text-sm font-semibold text-muted">{t.title.panel.notRated}</span>
                )}
              </span>
            )}
          </div>
        </div>
      )}

      <Categories item={item} all={categories} pending={pending} update={update} t={t} />
      <Notes item={item} pending={pending} update={update} t={t} />
      {props.reviews && (
        <ReviewSection itemId={item.id} reviews={props.reviews} partnerName={partner?.name ?? null} language={language} />
      )}

      {error && (
        <p role="alert" className="text-sm font-semibold text-danger">
          {error}
        </p>
      )}
      <div className="border-t-2 border-outline/15 pt-4">
        <RemoveButton pending={pending} onRemove={() => run(() => removeFromList(item.id))} t={t} />
      </div>
    </section>
  );
}

type Update = (changes: ListChanges, onDone?: () => void) => void;

function Progress({ item, seasons, pending, update, t }: { item: ListItem; seasons: number | null; pending: boolean; update: Update; t: Messages }) {
  const [editing, setEditing] = useState(false);
  const progress = item.season && item.episode ? { season: item.season, episode: item.episode } : null;
  // Watching an episode means you've started the series.
  const started = item.status === "want" ? { status: "watching" as const } : {};
  const nextSeason = (progress?.season ?? 0) + 1;

  if (editing) {
    return (
      <form
        className="paper flex flex-wrap items-end gap-3 rounded-control border-[3px] border-outline p-3"
        onSubmit={(e) => {
          e.preventDefault();
          const form = new FormData(e.currentTarget);
          const season = Number(form.get("season"));
          const episode = Number(form.get("episode"));
          update({ progress: season && episode ? { season, episode } : null }, () => setEditing(false));
        }}
      >
        <label className="grid gap-1">
          <span className="text-sm font-bold">{t.title.panel.season}</span>
          <input
            name="season"
            type="number"
            min={1}
            max={seasons ?? undefined}
            defaultValue={progress?.season ?? 1}
            className="field w-24"
          />
        </label>
        <label className="grid gap-1">
          <span className="text-sm font-bold">{t.title.panel.episode}</span>
          <input name="episode" type="number" min={1} defaultValue={progress?.episode ?? 1} className="field w-24" />
        </label>
        <button className="btn" disabled={pending}>
          {t.title.panel.save}
        </button>
        <button type="button" className="btn-quiet" onClick={() => setEditing(false)}>
          {t.title.panel.cancel}
        </button>
      </form>
    );
  }

  return (
    <div className="grid gap-2">
      <p>
        <span className="font-bold">{t.title.panel.progress}</span>
        <span className="font-medium">
          {progress
            ? t.title.panel.watchedUpTo(t.common.progress(progress.season, progress.episode))
            : t.title.panel.notStarted}
        </span>
      </p>
      <div className="flex flex-wrap items-center gap-2.5">
        <button
          className="btn-quiet text-sm"
          disabled={pending}
          onClick={() =>
            update({ ...started, progress: progress ? { ...progress, episode: progress.episode + 1 } : { season: 1, episode: 1 } })
          }
        >
          <PlusIcon className="size-3.5" />
          {progress ? t.title.panel.watchedEpisode(progress.episode + 1) : t.title.panel.watchedSeasonStart(1)}
        </button>
        {progress && (!seasons || nextSeason <= seasons) && (
          <button
            className="btn-quiet text-sm"
            disabled={pending}
            onClick={() => update({ ...started, progress: { season: nextSeason, episode: 1 } })}
          >
            {t.title.panel.watchedSeasonStart(nextSeason)}
          </button>
        )}
        <button className="tap-area px-1 text-sm font-bold underline underline-offset-4" onClick={() => setEditing(true)}>
          {t.title.panel.edit}
        </button>
      </div>
    </div>
  );
}

/**
 * Your own 1-5 rating: big cartoon stars that pop in, one after another, when you choose. Choosing your
 * current rating again clears it.
 */
export function StarPicker({ rating, disabled, onRate, t }: { rating: number | null; disabled: boolean; onRate: (rating: number | null) => void; t: Messages }) {
  const [hover, setHover] = useState<number | null>(null);
  // The stars up to the one just chosen pop; `round` replays it on every choice.
  const [popped, setPopped] = useState({ upTo: 0, round: 0 });
  const shown = hover ?? rating ?? 0;

  return (
    <span className="flex flex-wrap items-center gap-2">
      <NameTag name={t.common.you} who="me" />
      <span role="radiogroup" aria-label={t.title.panel.yourRating} className="flex" onMouseLeave={() => setHover(null)}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={rating === n}
            aria-label={t.title.panel.starCount(n)}
            title={rating === n ? t.title.panel.clearRating : undefined}
            disabled={disabled}
            onMouseEnter={() => setHover(n)}
            onClick={() => {
              // Choosing your current rating again clears it.
              const next = rating === n ? null : n;
              setPopped((p) => ({ upTo: next ?? 0, round: p.round + 1 }));
              onRate(next);
            }}
            className="grid size-11 place-items-center rounded-full transition duration-150 ease-(--ease-spring) hover:-translate-y-0.5 hover:-rotate-6 hover:scale-110 active:scale-90 disabled:opacity-60"
          >
            <span
              key={n <= popped.upTo ? `${n}-${popped.round}` : n}
              style={{ "--r": "0deg", animationDelay: `${(n - 1) * 45}ms` } as CSSProperties}
              className={`grid place-items-center ${n <= popped.upTo ? "motion-safe:animate-[pop_0.45s_cubic-bezier(0.2,1.4,0.4,1)_both]" : ""}`}
            >
              <StarIcon filled={n <= shown} className="size-9" />
            </span>
          </button>
        ))}
      </span>
    </span>
  );
}

function Categories({ item, all, pending, update, t }: { item: ListItem; all: string[]; pending: boolean; update: Update; t: Messages }) {
  const [draft, setDraft] = useState("");
  const options = [...new Set([...all, ...item.categories])].sort((a, b) => a.localeCompare(b));

  function save(next: string[], onDone?: () => void) {
    if (cleanCategories(next)) update({ categories: next }, onDone);
  }

  return (
    <div className="grid gap-2">
      <h3 className="text-lg font-bold">{t.title.panel.categories}</h3>
      <div className="flex flex-wrap items-center gap-2">
        {options.map((name) => {
          const on = item.categories.includes(name);
          return (
            <button
              key={name}
              aria-pressed={on}
              disabled={pending}
              onClick={() => save(on ? item.categories.filter((c) => c !== name) : [...item.categories, name])}
              className="chip disabled:opacity-60"
            >
              {name}
            </button>
          );
        })}
        <form
          className="flex min-w-0 gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const name = draft.trim();
            if (name) save([...item.categories, name], () => setDraft(""));
          }}
        >
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={MAX_CATEGORY_LENGTH}
            placeholder={t.title.panel.newCategory}
            aria-label={t.title.panel.newCategory}
            className="field w-40 py-1 text-sm"
          />
          <button className="btn-quiet text-sm" disabled={pending || !draft.trim()}>
            <PlusIcon className="size-3.5" />
            {t.title.panel.addCategory}
          </button>
        </form>
      </div>
    </div>
  );
}

function Notes({ item, pending, update, t }: { item: ListItem; pending: boolean; update: Update; t: Messages }) {
  // null until edited, so a note saved on the other screen shows up here.
  const [draft, setDraft] = useState<string | null>(null);
  const notes = draft ?? item.notes;
  const dirty = draft !== null && draft.trim() !== item.notes;

  return (
    <form
      className="grid gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        update({ notes }, () => setDraft(null));
      }}
    >
      <label className="grid gap-2">
        <span className="text-lg font-bold">{t.title.panel.note}</span>
        <textarea
          value={notes}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={MAX_NOTES_LENGTH}
          rows={2}
          placeholder={t.title.panel.notesPlaceholder}
          className="field"
        />
      </label>
      {dirty && (
        <div className="flex flex-wrap gap-2.5">
          <button className="btn" disabled={pending}>
            {t.title.panel.saveNote}
          </button>
          <button type="button" className="btn-quiet" onClick={() => setDraft(null)}>
            {t.title.panel.cancel}
          </button>
        </div>
      )}
    </form>
  );
}

function RemoveButton({ pending, onRemove, t }: { pending: boolean; onRemove: () => void; t: Messages }) {
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <button className="tap-area text-sm font-bold text-danger underline underline-offset-4" onClick={() => setConfirming(true)}>
        {t.title.panel.remove}
      </button>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="font-semibold">{t.title.panel.removeConfirm}</span>
      <button className="btn-quiet bg-danger-soft text-sm text-danger" disabled={pending} onClick={onRemove}>
        {t.title.panel.removeYes}
      </button>
      <button className="btn-quiet text-sm" onClick={() => setConfirming(false)}>
        {t.title.panel.removeNo}
      </button>
    </div>
  );
}
