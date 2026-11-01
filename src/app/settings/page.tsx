import { Suspense } from "react";
import { allTimeZones, countryOptions, isCountry } from "@/lib/places";
import { getServices } from "@/lib/services";
import { requireProfile } from "@/lib/session";
import { SettingsForm } from "./settings-form";

export const metadata = { title: "Settings · Two Couches" };

export default function SettingsPage({ searchParams }: PageProps<"/settings">) {
  return (
    <Suspense fallback={<p className="text-muted">Loading…</p>}>
      <Settings searchParams={searchParams} />
    </Suspense>
  );
}

async function Settings({ searchParams }: Pick<PageProps<"/settings">, "searchParams">) {
  const [profile, { welcome }] = await Promise.all([requireProfile(), searchParams]);
  const services = isCountry(profile.country) ? await getServices(profile.country) : [];

  return (
    <div className="grid gap-6">
      <div className="grid gap-2">
        <h1 className="font-display text-3xl font-bold tracking-tight">{welcome ? "Welcome" : "Settings"}</h1>
        <p className="text-muted">
          {welcome
            ? "Tell us where you watch from, so we can check what's streaming for you."
            : "Your country, time zone and the services you pay for."}
        </p>
      </div>
      <SettingsForm
        initial={profile}
        initialServices={services}
        countries={countryOptions(profile.language)}
        timeZones={allTimeZones()}
        isOnboarding={!profile.couple_id}
      />
    </div>
  );
}
