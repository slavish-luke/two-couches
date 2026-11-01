"use client";

import Image from "next/image";
import { useActionState, useRef, useState, useTransition } from "react";
import { isLanguage, LANGUAGES } from "@/lib/places";
import type { Service } from "@/lib/services";
import { loadServices, saveSettings } from "./actions";

const COLLAPSED_COUNT = 18;

type Props = {
  initial: {
    display_name: string;
    country: string | null;
    language: string;
    time_zone: string;
    services: number[];
  };
  initialServices: Service[];
  countries: { code: string; name: string }[];
  timeZones: string[];
  isOnboarding: boolean;
};

export function SettingsForm({ initial, initialServices, countries, timeZones, isOnboarding }: Props) {
  const [state, save, saving] = useActionState(saveSettings, {});
  const [country, setCountry] = useState(initial.country ?? "");
  const [language, setLanguage] = useState(initial.language);
  const [timeZone, setTimeZone] = useState(initial.time_zone);
  const [services, setServices] = useState(initialServices);
  const [selected, setSelected] = useState(() => new Set(initial.services));
  const [showAll, setShowAll] = useState(false);
  const [loadingServices, startLoadingServices] = useTransition();
  const latestCountry = useRef(country);

  function chooseCountry(next: string) {
    setCountry(next);
    latestCountry.current = next;
    setSelected(next === initial.country ? new Set(initial.services) : new Set());
    setShowAll(false);
    // First-time setup: start from this device's time zone and language.
    if (timeZone === "UTC") setTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone);
    if (!initial.country) {
      const deviceLanguage = navigator.language.slice(0, 2);
      if (isLanguage(deviceLanguage)) setLanguage(deviceLanguage);
    }
    startLoadingServices(async () => {
      const list = await loadServices(next);
      if (latestCountry.current === next) setServices(list);
    });
  }

  function toggleService(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const zoneOptions = timeZones.includes(timeZone) ? timeZones : [timeZone, ...timeZones];
  const countryLabel = countries.find((c) => c.code === country)?.name ?? country;
  const visible = showAll ? services : services.filter((s, i) => i < COLLAPSED_COUNT || selected.has(s.provider_id));

  return (
    <form action={save} className="grid gap-6">
      <label className="grid gap-1">
        <span className="text-sm font-semibold">Your name</span>
        <input name="display_name" required maxLength={50} defaultValue={initial.display_name} className="field" />
      </label>

      <label className="grid gap-1">
        <span className="text-sm font-semibold">Where you watch from</span>
        <select
          name="country"
          required
          value={country}
          onChange={(e) => chooseCountry(e.target.value)}
          className="field"
        >
          <option value="" disabled>
            Choose your country…
          </option>
          {countries.map((c) => (
            <option key={c.code} value={c.code}>
              {c.name}
            </option>
          ))}
        </select>
      </label>

      {country && (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1">
              <span className="text-sm font-semibold">Time zone</span>
              <select name="time_zone" value={timeZone} onChange={(e) => setTimeZone(e.target.value)} className="field">
                {zoneOptions.map((zone) => (
                  <option key={zone} value={zone}>
                    {zone.replaceAll("_", " ")}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1">
              <span className="text-sm font-semibold">App language</span>
              <select name="language" value={language} onChange={(e) => setLanguage(e.target.value)} className="field">
                {Object.entries(LANGUAGES).map(([code, name]) => (
                  <option key={code} value={code}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <fieldset className="grid gap-2" aria-busy={loadingServices}>
            <legend className="mb-1 text-sm font-semibold">Services you pay for in {countryLabel}</legend>
            {loadingServices ? (
              <p className="text-sm text-muted">Loading services…</p>
            ) : services.length === 0 ? (
              <p className="text-sm text-muted">
                No services listed for {countryLabel} yet. The list loads from TMDB once the app&apos;s TMDB key is
                set up.
              </p>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {visible.map((s) => (
                    <label
                      key={s.provider_id}
                      className="flex cursor-pointer items-center gap-2 rounded-lg border border-line bg-surface p-2 text-sm has-checked:border-both has-checked:bg-both-soft"
                    >
                      <input
                        type="checkbox"
                        name="services"
                        value={s.provider_id}
                        checked={selected.has(s.provider_id)}
                        onChange={() => toggleService(s.provider_id)}
                        className="accent-(--both)"
                      />
                      {s.logo_path && (
                        <Image
                          src={`https://image.tmdb.org/t/p/w92${s.logo_path}`}
                          alt=""
                          width={24}
                          height={24}
                          className="rounded"
                        />
                      )}
                      <span className="truncate">{s.name}</span>
                    </label>
                  ))}
                </div>
                {services.length > COLLAPSED_COUNT && (
                  <button
                    type="button"
                    onClick={() => setShowAll(!showAll)}
                    className="justify-self-start text-sm font-semibold text-partner"
                  >
                    {showAll ? "Show fewer" : `Show all ${services.length}`}
                  </button>
                )}
              </>
            )}
          </fieldset>
        </>
      )}

      {state.error && <p className="text-sm text-danger">{state.error}</p>}
      {state.saved && <p className="text-sm text-both">Saved.</p>}
      <button className="btn justify-self-start" disabled={saving || !country || loadingServices}>
        {saving ? "Saving…" : isOnboarding ? "Save and continue" : "Save"}
      </button>
    </form>
  );
}
