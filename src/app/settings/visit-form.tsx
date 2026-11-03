"use client";

import { useActionState, useState, useTransition } from "react";
import { getMessages } from "@/lib/i18n";
import type { Visit } from "@/lib/places";
import { endVisit, saveVisit, type VisitState } from "./actions";

type Props = {
  /** The visit in force now, or null at home. */
  visit: Visit | null;
  homeCountry: string;
  countries: { code: string; name: string }[];
  /** First and last "until" dates allowed, in the visitor's zone. */
  dates: { min: string; max: string };
  /** visit.until, formatted for the viewer. */
  untilLabel: string | null;
  language: string;
};

/** Same couch mode: "I'm in {country} until {date}", and "I'm back home". */
export function VisitForm({ visit, homeCountry, countries, dates, untilLabel, language }: Props) {
  const t = getMessages(language).places.visit;
  const [state, save, saving] = useActionState(saveVisit, {});
  const [ending, startEnding] = useTransition();
  const [endState, setEndState] = useState<VisitState>({});

  const visitName = visit ? (countries.find((c) => c.code === visit.country)?.name ?? visit.country) : null;

  return (
    <div className="grid gap-3">
      {visit && visitName && untilLabel && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg bg-me-soft p-3 text-me">
          <p className="text-sm font-semibold">{t.current(visitName, untilLabel)}</p>
          <button
            type="button"
            className="btn-quiet px-3 py-1.5 text-sm"
            disabled={ending}
            onClick={() => startEnding(async () => setEndState(await endVisit()))}
          >
            {ending ? t.ending : t.end}
          </button>
        </div>
      )}
      {/* Keyed by the visit, so ending or changing it resets the fields. */}
      <form key={visit ? `${visit.country}:${visit.until}` : "home"} action={save} className="grid gap-3">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1">
            <span className="text-sm font-semibold">{t.country}</span>
            <select name="visiting_country" required defaultValue={visit?.country ?? ""} className="field">
              <option value="" disabled>
                {t.chooseCountry}
              </option>
              {countries
                .filter((c) => c.code !== homeCountry)
                .map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name}
                  </option>
                ))}
            </select>
          </label>
          <label className="grid gap-1">
            <span className="text-sm font-semibold">{t.until}</span>
            <input
              type="date"
              name="visiting_until"
              required
              min={dates.min}
              max={dates.max}
              defaultValue={visit?.until ?? ""}
              className="field"
            />
          </label>
        </div>
        {(state.error || endState.error) && <p className="text-sm text-danger">{state.error ?? endState.error}</p>}
        <button className="btn justify-self-start" disabled={saving}>
          {saving ? t.saving : t.save}
        </button>
      </form>
    </div>
  );
}
