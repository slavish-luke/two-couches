import { Suspense, type ReactNode } from "react";
import { PageLoading } from "@/components/page-loading";
import { getI18n, localisedTitle } from "@/lib/i18n/server";
import { allTimeZones, countryOptions, formatVisitDate, isCountry, visitDateRange } from "@/lib/places";
import { getServices } from "@/lib/services";
import { requireProfile } from "@/lib/session";
import { Advisor } from "./advisor";
import { AppearanceSettings } from "./appearance-settings";
import { DataSaverSettings } from "./data-saver-settings";
import { InstallSettings } from "./install-settings";
import { NotificationSettings } from "./notification-settings";
import { SettingsForm } from "./settings-form";
import { SignOutButton } from "./sign-out-button";
import { VisitForm } from "./visit-form";

export const generateMetadata = localisedTitle("settings");

export default function SettingsPage({ searchParams }: PageProps<"/settings">) {
  return (
    <Suspense fallback={<PageLoading />}>
      <Settings searchParams={searchParams} />
    </Suspense>
  );
}

/** A paper panel with a cartoon heading and an optional intro. */
function Panel({ heading, intro, children }: { heading: string; intro?: string; children: ReactNode }) {
  return (
    <section className="card grid content-start gap-4">
      <div className="grid gap-1.5">
        <h3 className="display-ink text-2xl">{heading}</h3>
        {intro && <p className="max-w-[65ch] text-muted">{intro}</p>}
      </div>
      {children}
    </section>
  );
}

async function Settings({ searchParams }: Pick<PageProps<"/settings">, "searchParams">) {
  const [profile, { language, t }, { welcome }] = await Promise.all([requireProfile(), getI18n(), searchParams]);
  // The form edits home settings: a visit (same couch mode) has its own section below.
  const services = isCountry(profile.home_country) ? await getServices(profile.home_country) : [];
  const countries = countryOptions(language);

  return (
    <div className="grid gap-7">
      <div className="grid gap-3">
        <h1 className="display -rotate-1 text-[clamp(2.4rem,5vw,3.6rem)]">
          {welcome ? t.account.settings.welcome : t.account.settings.heading}
        </h1>
        <p className="max-w-[65ch] font-medium text-muted">
          {welcome ? t.account.settings.welcomeIntro : t.account.settings.intro}
        </p>
      </div>
      <SettingsForm
        initial={{ ...profile, country: profile.home_country }}
        initialServices={services}
        countries={countries}
        timeZones={allTimeZones()}
        isOnboarding={!profile.couple_id}
        language={language}
      />
      {profile.couple_id && profile.home_country && (
        <>
          <section className="card grid gap-4">
            <div className="grid gap-1.5">
              <h2 className="display-ink text-2xl">{t.places.visit.heading}</h2>
              <p className="max-w-[65ch] text-muted">{t.places.visit.intro}</p>
            </div>
            <VisitForm
              visit={profile.visit}
              homeCountry={profile.home_country}
              countries={countries}
              dates={visitDateRange(profile.time_zone)}
              untilLabel={profile.visit && formatVisitDate(profile.visit.until, language)}
              language={language}
            />
          </section>
          <Suspense fallback={<div aria-busy className="card h-48 motion-safe:animate-pulse" />}>
            <Advisor />
          </Suspense>
        </>
      )}

      <section className="mt-4 grid gap-5">
        <div className="grid gap-2">
          <h2 className="display text-[2rem]">{t.account.device.heading}</h2>
          <p className="font-medium text-muted">{t.account.device.intro}</p>
        </div>
        <Panel heading={t.account.appearance.heading}>
          <AppearanceSettings language={language} />
        </Panel>
        {profile.couple_id && (
          <Panel heading={t.account.notifications.heading} intro={t.account.notifications.intro}>
            <NotificationSettings vapidKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || null} language={language} />
          </Panel>
        )}
        <div className="grid gap-5 sm:grid-cols-2">
          <Panel heading={t.account.install.heading} intro={t.account.install.intro}>
            <InstallSettings language={language} />
          </Panel>
          <Panel heading={t.account.dataSaver.heading} intro={t.account.dataSaver.intro}>
            <DataSaverSettings language={language} />
          </Panel>
        </div>
      </section>

      <div className="mt-2 flex justify-end">
        <SignOutButton language={language} />
      </div>
    </div>
  );
}
