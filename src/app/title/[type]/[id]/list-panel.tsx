"use client";

import { useState, useTransition } from "react";
import { ReviewSection } from "@/app/after-night/review-box";
import { addToList, rateListItem, removeFromList, updateListItem, type ListChanges, type ListResult } from "@/app/list/actions";
import { Stars } from "@/components/stars";
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
    <section className="card grid gap-3">
      <h2 className="font-display text-xl font-semibold">{t.title.panel.saveForLater}</h2>
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
          {pending ? t.common.add.adding : t.title.panel.addToList}
        </button>
      </form>
      {error && <p className="text-sm text-danger">{error}</p>}
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
    <section className="card grid gap-5" aria-busy={pending}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-xl font-semibold">{t.title.panel.onOurList}</h2>
        <p className="text-sm text-muted">
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
            className={`rounded-full border px-3 py-1 text-sm font-semibold transition ${
              item.status === status ? "border-ink bg-ink text-bg" : "border-line text-muted hover:text-ink"
            }`}
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
          <span className="text-sm font-semibold">{t.title.panel.watchedOn}</span>
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
          <h3 className="text-sm font-semibold">{t.title.panel.ratings}</h3>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <StarPicker
              rating={item.ratings[me.id] ?? null}
              disabled={pending}
              onRate={(rating) => run(() => rateListItem(item.id, rating))}
              t={t}
            />
            {partner && (
              <span className="text-sm">
                {partner.name}:{" "}
                {item.ratings[partner.id] ? (
                  <Stars rating={item.ratings[partner.id]} who={partner.name} language={language} />
                ) : (
                  <span className="text-muted">{t.title.panel.notRated}</span>
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

      {error && <p className="text-sm text-danger">{error}</p>}
      <RemoveButton pending={pending} onRemove={() => run(() => removeFromList(item.id))} t={t} />
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
        className="flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          const form = new FormData(e.currentTarget);
          const season = Number(form.get("season"));
          const episode = Number(form.get("episode"));
          update({ progress: season && episode ? { season, episode } : null }, () => setEditing(false));
        }}
      >
        <label className="grid gap-1">
          <span className="text-sm font-semibold">{t.title.panel.season}</span>
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
          <span className="text-sm font-semibold">{t.title.panel.episode}</span>
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
    <div className="flex flex-wrap items-center gap-2">
      <span className="mr-1 text-sm">
        <span className="font-semibold">{t.title.panel.progress}</span>
        {progress
          ? t.title.panel.watchedUpTo(t.common.progress(progress.season, progress.episode))
          : t.title.panel.notStarted}
      </span>
      <button
        className="btn-quiet px-3 py-1 text-sm"
        disabled={pending}
        onClick={() =>
          update({ ...started, progress: progress ? { ...progress, episode: progress.episode + 1 } : { season: 1, episode: 1 } })
        }
      >
        {progress ? t.title.panel.watchedEpisode(progress.episode + 1) : t.title.panel.watchedSeasonStart(1)}
      </button>
      {progress && (!seasons || nextSeason <= seasons) && (
        <button
          className="btn-quiet px-3 py-1 text-sm"
          disabled={pending}
          onClick={() => update({ ...started, progress: { season: nextSeason, episode: 1 } })}
        >
          {t.title.panel.watchedSeasonStart(nextSeason)}
        </button>
      )}
      <button className="text-sm font-semibold text-partner" onClick={() => setEditing(true)}>
        {t.title.panel.edit}
      </button>
    </div>
  );
}

/** Your own 1-5 rating. Choosing your current rating again clears it. */
export function StarPicker({ rating, disabled, onRate, t }: { rating: number | null; disabled: boolean; onRate: (rating: number | null) => void; t: Messages }) {
  const [hover, setHover] = useState<number | null>(null);
  const shown = hover ?? rating ?? 0;

  return (
    <span className="flex items-center gap-2 text-sm">
      {t.common.you}:
      <span role="radiogroup" aria-label={t.title.panel.yourRating} className="flex" onMouseLeave={() => setHover(null)}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            role="radio"
            aria-checked={rating === n}
            aria-label={t.title.panel.starCount(n)}
            title={rating === n ? t.title.panel.clearRating : undefined}
            disabled={disabled}
            onMouseEnter={() => setHover(n)}
            // Choosing your current rating again clears it.
            onClick={() => onRate(rating === n ? null : n)}
            className={`px-0.5 text-2xl leading-none transition ${n <= shown ? "text-me" : "text-line"}`}
          >
            ★
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
      <h3 className="text-sm font-semibold">{t.title.panel.categories}</h3>
      <div className="flex flex-wrap items-center gap-2">
        {options.map((name) => {
          const on = item.categories.includes(name);
          return (
            <button
              key={name}
              aria-pressed={on}
              disabled={pending}
              onClick={() => save(on ? item.categories.filter((c) => c !== name) : [...item.categories, name])}
              className={`rounded-full border px-3 py-1 text-sm transition ${
                on ? "border-partner bg-partner-soft font-semibold text-partner" : "border-line text-muted hover:text-ink"
              }`}
            >
              {name}
            </button>
          );
        })}
        <form
          className="flex gap-2"
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
          <button className="btn-quiet px-3 py-1 text-sm" disabled={pending || !draft.trim()}>
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
      <label className="grid gap-1">
        <span className="text-sm font-semibold">{t.title.panel.note}</span>
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
        <div className="flex gap-2">
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
      <button className="justify-self-start text-sm font-semibold text-danger" onClick={() => setConfirming(true)}>
        {t.title.panel.remove}
      </button>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-3 text-sm">
      <span>{t.title.panel.removeConfirm}</span>
      <button className="font-semibold text-danger" disabled={pending} onClick={onRemove}>
        {t.title.panel.removeYes}
      </button>
      <button className="font-semibold text-muted" onClick={() => setConfirming(false)}>
        {t.title.panel.removeNo}
      </button>
    </div>
  );
}
