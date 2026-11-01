import { Suspense } from "react";
import { PageLoading } from "@/components/page-loading";
import { getI18n } from "@/lib/i18n/server";
import { allTimeZones, countryOptions, isCountry } from "@/lib/places";
import { getServices } from "@/lib/services";
import { requireProfile } from "@/lib/session";
import { SettingsForm } from "./settings-form";

export const metadata = { title: "Settings · Two Couches" };

export default function SettingsPage({ searchParams }: PageProps<"/settings">) {
  return (
    <Suspense fallback={<PageLoading />}>
      <Settings searchParams={searchParams} />
    </Suspense>
  );
}

async function Settings({ searchParams }: Pick<PageProps<"/settings">, "searchParams">) {
  const [profile, { language, t }, { welcome }] = await Promise.all([requireProfile(), getI18n(), searchParams]);
  const services = isCountry(profile.country) ? await getServices(profile.country) : [];

  return (
    <div className="grid gap-6">
      <div className="grid gap-2">
        <h1 className="font-display text-3xl font-bold tracking-tight">
          {welcome ? t.account.settings.welcome : t.account.settings.heading}
        </h1>
        <p className="text-muted">
          {welcome ? t.account.settings.welcomeIntro : t.account.settings.intro}
        </p>
      </div>
      <SettingsForm
        initial={profile}
        initialServices={services}
        countries={countryOptions(language)}
        timeZones={allTimeZones()}
        isOnboarding={!profile.couple_id}
        language={language}
      />
    </div>
  );
}
