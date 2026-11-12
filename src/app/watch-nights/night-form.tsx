"use client";

import { useEffect, useState, useTransition, type CSSProperties } from "react";
import { CheckIcon, CloseIcon, PlusIcon, StarIcon } from "@/components/icons";
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
} from "@/lib/night-rules";
import { bestSlots, dayPart, MAX_PROPOSAL_TIMES, MIN_PROPOSAL_TIMES, nowWithin, slotHeat, type DayPart } from "@/lib/planning-rules";
import { isDateString } from "@/lib/list-rules";
import { isMediaType, type TitleRef } from "@/lib/watch";
import { cancelWatchNight, proposeNight, saveWatchNight, type NightResult } from "./actions";

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

/** A start on the planner's own clock. */
type LocalTime = { date: string; time: string };

type Props = {
  /** null for a new night. */
  nightId: string | null;
  /** Whether either of you has started a ready check, which a new title or method clears. */
  hasReadyChecks?: boolean;
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

/** How much of the accent colour the best hour gets; less for worse ones (ink stays readable on every palette). */
const HEAT_MAX = 42;

/** An hour's fill: accent mixed in by how good it is for both of you (`--heat`, see globals.css). */
function heatStyle(heat: number) {
  return { "--heat": `${Math.round(heat * HEAT_MAX)}%` } as CSSProperties;
}

const LABEL = "text-[15px] font-bold";

/** Ticks every half minute, from the server's clock so the first render matches. */
function useNow(serverNow: string) {
  const [now, setNow] = useState(() => Date.parse(serverNow));
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => {
      clearInterval(timer);
    };
  }, []);
  return new Date(now);
}

/**
 * Plans or changes a watch night: what, when (with an hour grid shaded by how well each hour suits you
 * both) and how. A new night can instead suggest two or three times for your partner to pick from.
 */
export function NightForm(props: Props) {
  const { me, partner, language } = props;
  const t = getMessages(language);
  const text = t.nights.form;
  const [values, setValues] = useState(props.initial);
  const [several, setSeveral] = useState(false);
  const [chosen, setChosen] = useState<LocalTime[]>([]);
  const [full, setFull] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  const set = (changes: Partial<NightValues>) => setValues((v) => ({ ...v, ...changes }));
  const now = useNow(props.now);

  const today = zonedParts(new Date(props.now), me.timeZone).date;
  const zones = partner ? [me.timeZone, partner.timeZone] : [me.timeZone];
  const start = isDateString(values.date) && values.time ? zonedToUtc(values.date, values.time, me.timeZone) : null;
  // Proposing needs someone to propose to, and only a new night.
  const canPropose = Boolean(partner) && props.nightId === null;
  const proposing = canPropose && several;

  const instant = (t: LocalTime) => zonedToUtc(t.date, t.time, me.timeZone).getTime();
  const isChosen = (t: LocalTime) => chosen.some((c) => instant(c) === instant(t));
  function toggle(time: LocalTime) {
    setError(undefined);
    if (isChosen(time)) {
      setFull(false);
      setChosen((list) => list.filter((c) => instant(c) !== instant(time)));
    } else if (chosen.length >= MAX_PROPOSAL_TIMES) {
      setFull(true);
    } else {
      setChosen((list) => [...list, time].toSorted((a, b) => instant(a) - instant(b)));
    }
  }

  function run(action: () => Promise<NightResult>) {
    setError(undefined);
    startTransition(async () => {
      const result = await action();
      // On success the action redirects, so only errors come back.
      if (result?.error) setError(result.error);
    });
  }

  const details = () => ({
    title: parseKey(values.title),
    method: values.method,
    link: values.link,
    syncplay_server: values.syncplay_server,
    syncplay_room: values.syncplay_room,
    notes: values.notes,
  });

  return (
    <div className="grid gap-4">
      <form
        className="card grid gap-6"
        aria-busy={pending}
        onSubmit={(e) => {
          e.preventDefault();
          run(() =>
            proposing
              ? proposeNight({ ...details(), times: chosen })
              : saveWatchNight(props.nightId, { ...details(), date: values.date, time: values.time }),
          );
        }}
      >
        <label className="grid gap-1.5">
          <span className={LABEL}>{text.what}</span>
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

        <div className="grid gap-4">
          {canPropose && partner && (
            <div className="grid gap-2">
              <div role="radiogroup" aria-label={text.modesLabel} className="flex flex-wrap gap-2">
                {([false, true] as const).map((option) => (
                  <button
                    key={String(option)}
                    type="button"
                    role="radio"
                    aria-checked={several === option}
                    onClick={() => {
                      setSeveral(option);
                      setError(undefined);
                    }}
                    className="chip"
                  >
                    {option ? text.modes.several : text.modes.one}
                  </button>
                ))}
              </div>
              {several && <p className="text-sm text-muted">{text.severalHint(partner.name)}</p>}
            </div>
          )}

          <div className="flex flex-wrap items-end gap-3">
            <label className="grid gap-1.5">
              <span className={LABEL}>{text.day}</span>
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
              <span className={LABEL}>{text.time}</span>
              <input
                type="time"
                required={!proposing}
                step={900}
                value={values.time}
                onChange={(e) => set({ time: e.target.value })}
                className="field w-auto"
              />
            </label>
            {proposing && (
              <button
                type="button"
                disabled={!start || isChosen({ date: values.date, time: values.time })}
                onClick={() => toggle({ date: values.date, time: values.time })}
                className="btn-quiet mb-0.5 text-sm"
              >
                <PlusIcon className="size-4 [stroke-width:3]" />
                {text.addTime}
              </button>
            )}
            <span className="pb-2.5 text-sm text-muted">{text.zoneNote(me.timeZone.replace(/_/g, " "))}</span>
          </div>

          {isDateString(values.date) && (
            <HourPicker
              date={values.date}
              now={now}
              zones={zones}
              me={me}
              partner={partner}
              language={language}
              t={t}
              isPicked={(time) => (proposing ? isChosen({ date: values.date, time }) : time === values.time)}
              order={(time) => (proposing ? chosen.findIndex((c) => instant(c) === instant({ date: values.date, time })) : -1)}
              onPick={(time) => (proposing ? toggle({ date: values.date, time }) : set({ time }))}
            />
          )}

          {proposing ? (
            <Chosen chosen={chosen} full={full} me={me} partner={partner} zones={zones} language={language} t={t} onRemove={toggle} />
          ) : (
            start && <Summary start={start} me={me} partner={partner} zones={zones} language={language} t={t} />
          )}
        </div>

        <fieldset className="grid gap-3">
          <legend className={`mb-2 ${LABEL}`}>{text.how}</legend>
          <div role="radiogroup" aria-label={text.how} className="flex flex-wrap gap-2">
            {[null, ...NIGHT_METHODS].map((method) => (
              <button
                key={method ?? "undecided"}
                type="button"
                role="radio"
                aria-checked={values.method === method}
                onClick={() => set({ method })}
                className="chip"
              >
                {method ? t.nights.methods[method] : text.undecided}
              </button>
            ))}
          </div>
          {values.method && <p className="text-sm text-muted">{text.hints[values.method]}</p>}
          {(values.method === "teleparty" || values.method === "other") && (
            <label className="grid gap-1.5">
              <span className={LABEL}>{values.method === "teleparty" ? text.telepartyLink : text.otherLink}</span>
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
                <span className={LABEL}>{text.server}</span>
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
                <span className={LABEL}>{text.room}</span>
                <input
                  value={values.syncplay_room}
                  maxLength={MAX_SYNCPLAY_LENGTH}
                  autoCapitalize="none"
                  spellCheck={false}
                  onChange={(e) => set({ syncplay_room: e.target.value })}
                  className="field"
                />
              </label>
              <p className="text-sm text-muted sm:col-span-2">{text.roomNote}</p>
            </div>
          )}
        </fieldset>

        <label className="grid gap-1.5">
          <span className={LABEL}>{text.notes}</span>
          <textarea
            value={values.notes}
            maxLength={MAX_NIGHT_NOTES_LENGTH}
            rows={2}
            placeholder={text.notesPlaceholder}
            onChange={(e) => set({ notes: e.target.value })}
            className="field"
          />
        </label>

        <div className="grid justify-items-start gap-2.5 border-t-2 border-outline/15 pt-5">
          {error && (
            <p role="alert" className="font-semibold text-danger">
              {error}
            </p>
          )}
          <button className="btn" disabled={pending || (proposing && chosen.length < MIN_PROPOSAL_TIMES)}>
            {proposing && partner
              ? pending
                ? text.proposing
                : text.propose(partner.name)
              : pending
                ? text.saving
                : props.nightId
                  ? text.saveChanges
                  : text.save}
          </button>
          {props.hasReadyChecks && (values.title !== props.initial.title || values.method !== props.initial.method) && (
            <p className="text-sm text-muted">{text.resetsReady}</p>
          )}
          {partner && <p className="text-sm text-muted">{proposing ? text.proposeTold(partner.name) : text.partnerTold(partner.name)}</p>}
        </div>
      </form>

      {props.nightId && (
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            if (window.confirm(text.confirmCancel)) run(() => cancelWatchNight(props.nightId!));
          }}
          className="btn-quiet justify-self-start text-danger"
        >
          {pending ? text.cancelling : text.cancelNight}
        </button>
      )}
    </div>
  );
}

/**
 * The day's hours on your clock as a heat map for both of you: each hour is filled with more of the accent
 * the better it suits you both (hatched when someone's asleep), the best get a star, each person's line is
 * tinted at night on their own clock, and a line marks now. Picking an hour sets the time, or (when
 * suggesting several) adds or removes it.
 */
function HourPicker(props: {
  date: string;
  now: Date;
  zones: string[];
  me: Person;
  partner: Person | null;
  language: string;
  t: Messages;
  isPicked: (time: string) => boolean;
  /** Where a suggested hour comes in the list (0-based), or -1. */
  order: (time: string) => number;
  onPick: (time: string) => void;
}) {
  const { me, partner, language, t, now } = props;
  const text = t.nights.form;
  const hours = hoursOfDay(props.date, me.timeZone);
  const best = bestSlots(hours, props.zones, now);

  return (
    <div className="grid gap-3">
      <div role="group" aria-label={text.slotsLabel} className="grid grid-cols-4 gap-1.5 sm:grid-cols-6 sm:gap-2">
        {hours.map((start) => {
          const local = zonedParts(start, me.timeZone);
          const rating = rateSlot(start, props.zones);
          const heat = slotHeat(start, props.zones);
          const picked = props.isPicked(local.time);
          const order = props.order(local.time);
          const past = start.getTime() + 60 * 60 * 1000 <= now.getTime();
          const isBest = best.has(start.getTime());
          const into = nowWithin(start, now);
          const mine = formatShortTime(start, me.timeZone, language);
          const myPart = dayPart(start, me.timeZone);
          let theirs: string | null = null;
          const theirPart = partner ? dayPart(start, partner.timeZone) : null;
          if (partner) {
            theirs = formatShortTime(start, partner.timeZone, language);
            if (zonedParts(start, partner.timeZone).date !== props.date) {
              theirs = `${formatWeekday(start, partner.timeZone, language)} ${theirs}`;
            }
          }
          const label = [
            mine,
            partner && theirs ? t.nights.timeFor(partner.name, theirs) : null,
            text.legend[rating],
            isBest ? text.slot.best : null,
            partner && myPart === "night" ? text.slot.night(t.common.you) : null,
            partner && theirPart === "night" ? text.slot.night(partner.name) : null,
            into !== null ? text.slot.now : null,
            order >= 0 ? text.slot.chosen : null,
          ]
            .filter(Boolean)
            .join(" · ");
          return (
            <button
              key={start.getTime()}
              type="button"
              aria-pressed={picked}
              disabled={past}
              aria-label={label}
              onClick={() => props.onPick(local.time)}
              data-slot={rating}
              data-picked={picked || undefined}
              style={heatStyle(heat)}
              className={`relative grid min-w-0 gap-0.5 rounded-control border-[2.5px] border-outline px-1.5 pb-1.5 pt-1 text-left leading-tight transition duration-200 ease-(--ease-spring) sm:px-2 disabled:opacity-35 ${
                picked
                  ? "z-10 -rotate-3 scale-110 shadow-[var(--lift-sm)_var(--lift-sm)_0_var(--outline)]"
                  : `${rating === "late" ? "border-dashed" : ""} enabled:hover:-translate-y-0.5 enabled:hover:-rotate-2 enabled:hover:shadow-[var(--lift-sm)_var(--lift-sm)_0_var(--outline)]`
              }`}
            >
              <span
                data-sky={partner ? myPart : undefined}
                className="-mx-1 flex min-w-0 items-center gap-0.5 whitespace-nowrap rounded-[6px] px-1 text-sm font-bold sm:-mx-1.5 sm:gap-1 sm:px-1.5 sm:text-[15px]"
              >
                {partner && <SkyDot fill="fill-me" part={myPart} />}
                {mine}
              </span>
              {theirs && theirPart && (
                <span
                  data-sky={theirPart}
                  className="-mx-1 flex min-w-0 items-center gap-0.5 whitespace-nowrap rounded-[6px] px-1 text-[11px] font-semibold sm:-mx-1.5 sm:gap-1 sm:px-1.5 sm:text-xs"
                >
                  <SkyDot fill="fill-partner" part={theirPart} />
                  {theirs}
                </span>
              )}
              {into !== null && (
                <span aria-hidden data-now-line style={{ left: `${into * 100}%` }} className="absolute -inset-y-1.5 w-[3px] -translate-x-1/2 rounded-full" />
              )}
              {order >= 0 ? (
                <span
                  aria-hidden
                  className="absolute -right-2 -top-2.5 grid size-5 rotate-6 place-items-center rounded-full border-2 border-outline bg-pop font-sans text-xs font-bold text-ink"
                >
                  {order + 1}
                </span>
              ) : (
                isBest &&
                !picked && <StarIcon filled className="absolute -right-2 -top-2.5 size-[18px] rotate-12 sm:size-5" />
              )}
            </button>
          );
        })}
      </div>
      <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm font-semibold text-muted">
        {partner && (
          <>
            <li className="flex items-center gap-1.5">
              <Dot fill="bg-me" />
              {me.name}
            </li>
            <li className="flex items-center gap-1.5">
              <Dot fill="bg-partner" />
              {partner.name}
            </li>
          </>
        )}
        <li className="flex items-center gap-1.5">
          {text.heat.worse}
          <span aria-hidden className="flex overflow-hidden rounded-full border-2 border-outline">
            {[0.33, 0.55, 0.78, 1].map((heat) => (
              <span key={heat} data-slot="great" style={heatStyle(heat)} className="h-4 w-3.5" />
            ))}
          </span>
          {text.heat.better}
        </li>
        <li className="flex items-center gap-1.5">
          <StarIcon filled className="size-[18px]" />
          {text.heat.best}
        </li>
        <li className="flex items-center gap-1.5">
          <span aria-hidden data-slot="late" className="h-4 w-6 shrink-0 rounded-full border-2 border-dashed border-outline" />
          {text.legend.late}
        </li>
        {partner && (
          <li className="flex items-center gap-1.5">
            <span aria-hidden data-sky="night" className="flex h-4 items-center rounded-[5px] px-1">
              <SkyDot fill="fill-partner" part="night" />
            </span>
            {text.heat.night}
          </li>
        )}
        <li className="flex items-center gap-1.5">
          <span aria-hidden data-now-line className="h-4 w-[3px] rounded-full" />
          {text.heat.now}
        </li>
      </ul>
    </div>
  );
}

/** A person's mark in an hour: a round dot by day, a crescent moon at night on their clock. */
function SkyDot({ fill, part }: { fill: string; part: DayPart }) {
  return (
    <svg aria-hidden viewBox="0 0 10 10" className={`size-2.5 shrink-0 overflow-visible sm:size-3 ${fill}`}>
      {part === "day" ? (
        <circle cx="5" cy="5" r="4" stroke="var(--ink)" strokeWidth="1.6" />
      ) : (
        <path d="M7 1.54A4 4 0 1 0 8.76 6.37 3 3 0 0 1 7 1.54Z" stroke="var(--ink)" strokeWidth="1.5" strokeLinejoin="round" />
      )}
    </svg>
  );
}

/** A person's colour dot. */
function Dot({ fill }: { fill: string }) {
  return <span aria-hidden className={`size-2.5 shrink-0 rounded-full border-2 border-outline ${fill}`} />;
}

/** The times you're suggesting, soonest first, each on both clocks with a way to take it off. */
function Chosen(props: {
  chosen: LocalTime[];
  full: boolean;
  me: Person;
  partner: Person | null;
  zones: string[];
  language: string;
  t: Messages;
  onRemove: (time: LocalTime) => void;
}) {
  const { me, partner, language, t } = props;
  const text = t.nights.form;
  const when = (start: Date, zone: string) => `${formatDay(start, zone, language)}, ${formatTime(start, zone, language)}`;
  return (
    <div className="paper grid gap-2 rounded-control border-[3px] border-outline p-3">
      <p className="font-bold">{text.chosen}</p>
      {props.chosen.length === 0 ? (
        <p className="text-sm text-muted">{text.chosenEmpty}</p>
      ) : (
        <ol className="grid gap-2">
          {props.chosen.map((time, i) => {
            const start = zonedToUtc(time.date, time.time, me.timeZone);
            const great = rateSlot(start, props.zones) === "great";
            return (
              <li key={start.getTime()} className="flex items-start gap-2.5">
                <span
                  aria-hidden
                  className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full border-2 border-outline bg-pop text-sm font-bold text-ink"
                >
                  {i + 1}
                </span>
                <span className="grid min-w-0 flex-1 gap-0.5 text-sm">
                  <span className="flex flex-wrap items-center gap-x-2 font-semibold">
                    <Dot fill="bg-me" />
                    {t.nights.timeFor(t.common.you, when(start, me.timeZone))}
                  </span>
                  {partner && (
                    <span className="flex flex-wrap items-center gap-x-2 font-semibold">
                      <Dot fill="bg-partner" />
                      {t.nights.timeFor(partner.name, when(start, partner.timeZone))}
                    </span>
                  )}
                  <span className={`flex items-center gap-1.5 ${great ? "font-bold" : "text-muted"}`}>
                    {great && (
                      <span
                        aria-hidden
                        className="grid size-4 shrink-0 place-items-center rounded-full border-2 border-outline bg-accent text-on-accent"
                      >
                        <CheckIcon className="size-2.5 [stroke-width:4]" />
                      </span>
                    )}
                    {text.verdict[rateSlot(start, props.zones)]}
                  </span>
                </span>
                <button
                  type="button"
                  aria-label={text.removeTime(when(start, me.timeZone))}
                  onClick={() => props.onRemove(time)}
                  className="tap-area grid size-7 shrink-0 place-items-center rounded-full text-muted transition hover:bg-current/10 hover:text-ink"
                >
                  <CloseIcon className="size-4 [stroke-width:2.75]" />
                </button>
              </li>
            );
          })}
        </ol>
      )}
      {props.full && (
        <p role="status" className="text-sm font-semibold">
          {text.maxTimes}
        </p>
      )}
    </div>
  );
}

/** The chosen start on each person's clock, and how well it suits you both. */
function Summary(props: { start: Date; me: Person; partner: Person | null; zones: string[]; language: string; t: Messages }) {
  const { start, me, partner, language, t } = props;
  const rating = rateSlot(start, props.zones);
  const when = (zone: string) => `${formatDay(start, zone, language)}, ${formatTime(start, zone, language)}`;
  const people = [
    { name: t.common.you, zone: me.timeZone, fill: "bg-me" },
    ...(partner ? [{ name: partner.name, zone: partner.timeZone, fill: "bg-partner" }] : []),
  ];
  return (
    <div
      className={`paper grid gap-2 rounded-control border-[3px] border-outline p-3 ${rating === "great" ? "bg-accent-soft" : ""}`}
    >
      <ul className="grid gap-1.5">
        {people.map((person) => (
          <li key={person.fill} className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <span className={`rounded-full border-[2.5px] border-outline px-2.5 text-sm font-bold ${person.fill}`}>
              {person.name}
            </span>
            <span className="font-semibold">{when(person.zone)}</span>
          </li>
        ))}
      </ul>
      {partner && (
        <p className={`flex items-start gap-2 ${rating === "great" ? "font-bold" : "font-semibold text-muted"}`}>
          {rating === "great" && (
            <span
              aria-hidden
              className="mt-px grid size-5 shrink-0 place-items-center rounded-full border-2 border-outline bg-accent text-on-accent"
            >
              <CheckIcon className="size-3 [stroke-width:3.5]" />
            </span>
          )}
          {t.nights.form.verdict[rating]}
        </p>
      )}
    </div>
  );
}
