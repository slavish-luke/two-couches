"use client";

import { useState, useTransition } from "react";
import { getMessages, type Messages } from "@/lib/i18n";
import {
  addDays,
  formatDay,
  formatShortTime,
  formatTime,
  formatWeekday,
  hoursOfDay,
  MAX_DAYS_AHEAD,
  MAX_LINK_LENGTH,
  MAX_NIGHT_NOTES_LENGTH,
  MAX_SYNCPLAY_LENGTH,
  NIGHT_METHODS,
  rateSlot,
  zonedParts,
  zonedToUtc,
  type NightMethod,
  type SlotRating,
} from "@/lib/night-rules";
import { isDateString } from "@/lib/list-rules";
import { isMediaType, type TitleRef } from "@/lib/watch";
import { cancelWatchNight, saveWatchNight, type NightResult } from "./actions";

type Person = { name: string; timeZone: string };

/** A title that can be picked, keyed by titleKey(). */
export type TitleOption = { key: string; title: string };

export type NightValues = {
  /** titleKey(), or "" to decide later. */
  title: string;
  date: string;
  time: string;
  method: NightMethod | null;
  link: string;
  syncplay_server: string;
  syncplay_room: string;
  notes: string;
};

type Props = {
  /** null for a new night. */
  nightId: string | null;
  initial: NightValues;
  /** Titles from the list, plus any title the form was opened for. */
  options: TitleOption[];
  /** A title that isn't on the list (the one the form was opened for), shown first. */
  extra: TitleOption | null;
  me: Person;
  partner: Person | null;
  /** When the page was rendered, as an ISO string, so server and browser agree on which hours have passed. */
  now: string;
  language: string;
};

function parseKey(key: string): TitleRef | null {
  const [type, id] = key.split(":");
  return isMediaType(type) && Number(id) > 0 ? { media_type: type, tmdb_id: Number(id) } : null;
}

const SLOT_STYLE: Record<SlotRating, string> = {
  great: "border-both bg-both-soft",
  possible: "border-line bg-surface",
  late: "border-dashed border-line bg-bg text-muted",
};

/** Plans or changes a watch night: what, when (with an hour picker rated for both of you) and how. */
export function NightForm(props: Props) {
  const { me, partner, language } = props;
  const t = getMessages(language);
  const text = t.nights.form;
  const [values, setValues] = useState(props.initial);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  const set = (changes: Partial<NightValues>) => setValues((v) => ({ ...v, ...changes }));

  const today = zonedParts(new Date(props.now), me.timeZone).date;
  const zones = partner ? [me.timeZone, partner.timeZone] : [me.timeZone];
  const start = isDateString(values.date) && values.time ? zonedToUtc(values.date, values.time, me.timeZone) : null;

  function run(action: () => Promise<NightResult>) {
    setError(undefined);
    startTransition(async () => {
      const result = await action();
      // On success the action redirects, so only errors come back.
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div className="grid gap-4">
      <form
        className="card grid gap-6"
        aria-busy={pending}
        onSubmit={(e) => {
          e.preventDefault();
          run(() =>
            saveWatchNight(props.nightId, {
              title: parseKey(values.title),
              date: values.date,
              time: values.time,
              method: values.method,
              link: values.link,
              syncplay_server: values.syncplay_server,
              syncplay_room: values.syncplay_room,
              notes: values.notes,
            }),
          );
        }}
      >
        <label className="grid gap-1.5">
          <span className="text-sm font-semibold">{text.what}</span>
          <select value={values.title} onChange={(e) => set({ title: e.target.value })} className="field">
            <option value="">{text.pickLater}</option>
            {props.extra && <option value={props.extra.key}>{props.extra.title}</option>}
            {props.options.length > 0 && (
              <optgroup label={text.fromList}>
                {props.options.map((o) => (
                  <option key={o.key} value={o.key}>
                    {o.title}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        </label>

        <div className="grid gap-3">
          <div className="flex flex-wrap items-end gap-3">
            <label className="grid gap-1.5">
              <span className="text-sm font-semibold">{text.day}</span>
              <input
                type="date"
                required
                value={values.date}
                // An edited night may already be under way.
                min={props.nightId ? undefined : today}
                max={addDays(today, MAX_DAYS_AHEAD)}
                onChange={(e) => set({ date: e.target.value })}
                className="field w-auto"
              />
            </label>
            <label className="grid gap-1.5">
              <span className="text-sm font-semibold">{text.time}</span>
              <input
                type="time"
                required
                step={900}
                value={values.time}
                onChange={(e) => set({ time: e.target.value })}
                className="field w-auto"
              />
            </label>
            <span className="pb-2 text-xs text-muted">{text.zoneNote(me.timeZone.replace(/_/g, " "))}</span>
          </div>

          {isDateString(values.date) && (
            <HourPicker
              date={values.date}
              time={values.time}
              now={new Date(props.now)}
              zones={zones}
              me={me}
              partner={partner}
              language={language}
              t={t}
              onPick={(time) => set({ time })}
            />
          )}

          {start && <Summary start={start} me={me} partner={partner} zones={zones} language={language} t={t} />}
        </div>

        <fieldset className="grid gap-3">
          <legend className="mb-1.5 text-sm font-semibold">{text.how}</legend>
          <div role="radiogroup" aria-label={text.how} className="flex flex-wrap gap-2">
            {[null, ...NIGHT_METHODS].map((method) => (
              <button
                key={method ?? "undecided"}
                type="button"
                role="radio"
                aria-checked={values.method === method}
                onClick={() => set({ method })}
                className={`rounded-full border px-3 py-1 text-sm font-semibold transition ${
                  values.method === method ? "border-ink bg-ink text-bg" : "border-line text-muted hover:text-ink"
                }`}
              >
                {method ? t.nights.methods[method] : text.undecided}
              </button>
            ))}
          </div>
          {values.method && <p className="text-sm text-muted">{text.hints[values.method]}</p>}
          {(values.method === "teleparty" || values.method === "other") && (
            <label className="grid gap-1.5">
              <span className="text-sm font-semibold">{values.method === "teleparty" ? text.telepartyLink : text.otherLink}</span>
              <input
                type="url"
                inputMode="url"
                value={values.link}
                maxLength={MAX_LINK_LENGTH}
                placeholder="https://"
                onChange={(e) => set({ link: e.target.value })}
                className="field"
              />
            </label>
          )}
          {values.method === "syncplay" && (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1.5">
                <span className="text-sm font-semibold">{text.server}</span>
                <input
                  value={values.syncplay_server}
                  maxLength={MAX_SYNCPLAY_LENGTH}
                  placeholder="server.example.com:8999"
                  autoCapitalize="none"
                  spellCheck={false}
                  onChange={(e) => set({ syncplay_server: e.target.value })}
                  className="field"
                />
              </label>
              <label className="grid gap-1.5">
                <span className="text-sm font-semibold">{text.room}</span>
                <input
                  value={values.syncplay_room}
                  maxLength={MAX_SYNCPLAY_LENGTH}
                  autoCapitalize="none"
                  spellCheck={false}
                  onChange={(e) => set({ syncplay_room: e.target.value })}
                  className="field"
                />
              </label>
              <p className="text-xs text-muted sm:col-span-2">{text.roomNote}</p>
            </div>
          )}
        </fieldset>

        <label className="grid gap-1.5">
          <span className="text-sm font-semibold">{text.notes}</span>
          <textarea
            value={values.notes}
            maxLength={MAX_NIGHT_NOTES_LENGTH}
            rows={2}
            placeholder={text.notesPlaceholder}
            onChange={(e) => set({ notes: e.target.value })}
            className="field"
          />
        </label>

        <div className="grid justify-items-start gap-2">
          {error && (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          )}
          <button className="btn" disabled={pending}>
            {pending ? text.saving : props.nightId ? text.saveChanges : text.save}
          </button>
          {partner && <p className="text-xs text-muted">{text.partnerTold(partner.name)}</p>}
        </div>
      </form>

      {props.nightId && (
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            if (window.confirm(text.confirmCancel)) run(() => cancelWatchNight(props.nightId!));
          }}
          className="justify-self-start text-sm font-semibold text-danger hover:underline disabled:opacity-50"
        >
          {pending ? text.cancelling : text.cancelNight}
        </button>
      )}
    </div>
  );
}

/** The day's hours on your clock, each with your partner's time and coloured by how well it suits you both. */
function HourPicker(props: {
  date: string;
  time: string;
  now: Date;
  zones: string[];
  me: Person;
  partner: Person | null;
  language: string;
  t: Messages;
  onPick: (time: string) => void;
}) {
  const { me, partner, language, t } = props;
  const text = t.nights.form;
  const pickedHour = props.time ? Number(props.time.slice(0, 2)) : null;

  return (
    <div className="grid gap-2">
      <div role="group" aria-label={text.slotsLabel} className="grid grid-cols-4 gap-1.5 sm:grid-cols-6">
        {hoursOfDay(props.date, me.timeZone).map((start) => {
          const local = zonedParts(start, me.timeZone);
          const rating = rateSlot(start, props.zones);
          const picked = local.hour === pickedHour;
          const past = start.getTime() + 60 * 60 * 1000 <= props.now.getTime();
          const mine = formatShortTime(start, me.timeZone, language);
          let theirs: string | null = null;
          if (partner) {
            theirs = formatShortTime(start, partner.timeZone, language);
            if (zonedParts(start, partner.timeZone).date !== props.date) {
              theirs = `${formatWeekday(start, partner.timeZone, language)} ${theirs}`;
            }
          }
          return (
            <button
              key={start.getTime()}
              type="button"
              aria-pressed={picked}
              disabled={past}
              aria-label={[mine, partner && theirs ? t.nights.timeFor(partner.name, theirs) : null, text.legend[rating]]
                .filter(Boolean)
                .join(" · ")}
              onClick={() => props.onPick(local.time)}
              className={`grid rounded-lg border px-1.5 py-1 text-left leading-tight transition disabled:opacity-40 ${SLOT_STYLE[rating]} ${
                picked ? "ring-2 ring-ink" : "hover:border-muted"
              }`}
            >
              <span className="text-sm font-semibold text-me">{mine}</span>
              {theirs && <span className="text-xs text-partner">{theirs}</span>}
            </button>
          );
        })}
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        {(["great", "possible", "late"] as const).map((rating) => (
          <li key={rating} className="flex items-center gap-1.5">
            <span aria-hidden className={`size-3 rounded border ${SLOT_STYLE[rating]}`} />
            {text.legend[rating]}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** The chosen start on each person's clock, and how well it suits you both. */
function Summary(props: { start: Date; me: Person; partner: Person | null; zones: string[]; language: string; t: Messages }) {
  const { start, me, partner, language, t } = props;
  const rating = rateSlot(start, props.zones);
  const when = (zone: string) => `${formatDay(start, zone, language)}, ${formatTime(start, zone, language)}`;
  return (
    <div className={`grid gap-0.5 rounded-lg border p-3 text-sm ${rating === "great" ? "border-both bg-both-soft" : "border-line"}`}>
      <p className="font-semibold text-me">{t.nights.timeFor(t.common.you, when(me.timeZone))}</p>
      {partner && <p className="font-semibold text-partner">{t.nights.timeFor(partner.name, when(partner.timeZone))}</p>}
      {partner && (
        <p className={rating === "great" ? "text-both" : "text-muted"}>
          {rating === "great" && <span aria-hidden>● </span>}
          {t.nights.form.verdict[rating]}
        </p>
      )}
    </div>
  );
}
