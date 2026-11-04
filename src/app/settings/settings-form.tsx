"use client";

import Image from "next/image";
import { useActionState, useRef, useState, useTransition } from "react";
import { CheckIcon } from "@/components/icons";
import { getMessages } from "@/lib/i18n";
import { isLanguage, LANGUAGES } from "@/lib/places";
import type { Service } from "@/lib/services";
import { tmdbImage } from "@/lib/watch";
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
  /** The saved UI language, not the one picked in the form. */
  language: string;
};

/** Profile and services: one form in two paper panels, saved together from the foot of the last one. */
export function SettingsForm({
  initial,
  initialServices,
  countries,
  timeZones,
  isOnboarding,
  language: uiLanguage,
}: Props) {
  const [state, save, saving] = useActionState(saveSettings, {});
  const [country, setCountry] = useState(initial.country ?? "");
  const [language, setLanguage] = useState(initial.language);
  const [timeZone, setTimeZone] = useState(initial.time_zone);
  const [services, setServices] = useState(initialServices);
  const [selected, setSelected] = useState(() => new Set(initial.services));
  const [showAll, setShowAll] = useState(false);
  const [loadingServices, startLoadingServices] = useTransition();
  const latestCountry = useRef(country);
  const t = getMessages(uiLanguage).account.settings;

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

  // Save sits at the foot of the last panel: the services once a country is picked, else the profile.
  const footer = (
    <div className="flex flex-wrap items-center gap-3 border-t-2 border-outline/15 pt-4">
      <button className="btn" disabled={saving || !country || loadingServices}>
        {saving ? t.saving : isOnboarding ? t.saveAndContinue : t.save}
      </button>
      {state.error && (
        <p role="alert" className="text-sm font-semibold text-danger">
          {state.error}
        </p>
      )}
      {state.saved && (
        <p
          role="status"
          className="inline-flex items-center gap-1.5 rounded-full border-2 border-outline bg-accent-soft px-2.5 py-0.5 text-sm font-bold"
        >
          <CheckIcon />
          {t.saved}
        </p>
      )}
    </div>
  );

  return (
    <form action={save} className="grid gap-7">
      <section className="card grid gap-4">
        <h2 className="display-ink text-2xl">{t.profile}</h2>
        <label className="grid gap-1.5">
          <span className="font-semibold">{t.name}</span>
          <input name="display_name" required maxLength={50} defaultValue={initial.display_name} className="field" />
        </label>

        <label className="grid gap-1.5">
          <span className="font-semibold">{t.country}</span>
          <select
            name="country"
            required
            value={country}
            onChange={(e) => chooseCountry(e.target.value)}
            className="field"
          >
            <option value="" disabled>
              {t.chooseCountry}
            </option>
            {countries.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </select>
        </label>

        {country && (
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1.5">
              <span className="font-semibold">{t.timeZone}</span>
              <select name="time_zone" value={timeZone} onChange={(e) => setTimeZone(e.target.value)} className="field">
                {zoneOptions.map((zone) => (
                  <option key={zone} value={zone}>
                    {zone.replaceAll("_", " ")}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1.5">
              <span className="font-semibold">{t.language}</span>
              <select name="language" value={language} onChange={(e) => setLanguage(e.target.value)} className="field">
                {Object.entries(LANGUAGES).map(([code, name]) => (
                  <option key={code} value={code}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}
        {!country && footer}
      </section>

      {country && (
        <section className="card grid gap-4">
          <fieldset className="grid min-w-0 gap-4" aria-busy={loadingServices}>
            <legend className="display-ink mb-4 text-2xl">{t.services(countryLabel)}</legend>
            {loadingServices ? (
              <p className="text-muted">{t.loadingServices}</p>
            ) : services.length === 0 ? (
              <p className="text-muted">{t.noServices(countryLabel)}</p>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                  {visible.map((s) => (
                    <label
                      key={s.provider_id}
                      className="group flex min-w-0 cursor-pointer items-center gap-2 rounded-control border-[2.5px] border-outline bg-surface p-1.5 pr-1.5 font-semibold sm:pr-2 leading-tight transition duration-150 ease-(--ease-spring) hover:-translate-y-0.5 hover:-rotate-1 has-checked:bg-accent has-checked:text-on-accent has-checked:shadow-[var(--lift-sm)_var(--lift-sm)_0_var(--outline)] has-focus-visible:outline-3 has-focus-visible:outline-offset-3 has-focus-visible:outline-accent"
                    >
                      <input
                        type="checkbox"
                        name="services"
                        value={s.provider_id}
                        checked={selected.has(s.provider_id)}
                        onChange={() => toggleService(s.provider_id)}
                        className="sr-only"
                      />
                      {s.logo_path ? (
                        <Image
                          src={tmdbImage(s.logo_path, "w92")}
                          alt=""
                          width={32}
                          height={32}
                          unoptimized
                          className="size-7 shrink-0 rounded-lg border-2 border-outline bg-surface sm:size-8"
                        />
                      ) : (
                        <span aria-hidden className="size-7 shrink-0 rounded-lg border-2 border-outline bg-surface sm:size-8" />
                      )}
                      {/* Two lines on phones rather than an ellipsis after a few letters. */}
                      <span className="line-clamp-2 min-w-0 flex-1 text-sm [overflow-wrap:anywhere] sm:text-[15px]">{s.name}</span>
                      {/* The tick: shown once the service is chosen. */}
                      <span
                        aria-hidden
                        className="grid size-[18px] shrink-0 place-items-center rounded-lg border-2 border-outline bg-surface text-ink opacity-0 transition group-has-checked:opacity-100"
                      >
                        <CheckIcon className="size-3.5" />
                      </span>
                    </label>
                  ))}
                </div>
                {services.length > COLLAPSED_COUNT && (
                  <button
                    type="button"
                    onClick={() => setShowAll(!showAll)}
                    className="btn-quiet justify-self-start text-sm"
                  >
                    {showAll ? t.showFewer : t.showAll(services.length)}
                  </button>
                )}
              </>
            )}
          </fieldset>
          {footer}
        </section>
      )}
    </form>
  );
}
