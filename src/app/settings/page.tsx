import { Suspense } from "react";
import { PageLoading } from "@/components/page-loading";
import { getI18n, localisedTitle } from "@/lib/i18n/server";
import { allTimeZones, countryOptions, formatVisitDate, isCountry, visitDateRange } from "@/lib/places";
import { getServices } from "@/lib/services";
import { requireProfile } from "@/lib/session";
import { Advisor } from "./advisor";
import { AppearanceSettings } from "./appearance-settings";
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

async function Settings({ searchParams }: Pick<PageProps<"/settings">, "searchParams">) {
  const [profile, { language, t }, { welcome }] = await Promise.all([requireProfile(), getI18n(), searchParams]);
  // The form edits home settings: a visit (same couch mode) has its own section below.
  const services = isCountry(profile.home_country) ? await getServices(profile.home_country) : [];
  const countries = countryOptions(language);

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
        initial={{ ...profile, country: profile.home_country }}
        initialServices={services}
        countries={countries}
        timeZones={allTimeZones()}
        isOnboarding={!profile.couple_id}
        language={language}
      />
      {profile.couple_id && profile.home_country && (
        <>
          <Suspense
            fallback={
              <div className="border-t border-line pt-6">
                <PageLoading />
              </div>
            }
          >
            <Advisor />
          </Suspense>
          <section className="grid gap-3 border-t border-line pt-6">
            <div className="grid gap-1">
              <h2 className="font-display text-2xl font-bold tracking-tight">{t.places.visit.heading}</h2>
              <p className="text-muted">{t.places.visit.intro}</p>
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
        </>
      )}
      <section className="grid gap-6 border-t border-line pt-6">
        <div className="grid gap-1">
          <h2 className="font-display text-2xl font-bold tracking-tight">{t.account.device.heading}</h2>
          <p className="text-muted">{t.account.device.intro}</p>
        </div>
        <div className="grid gap-2">
          <h3 className="font-display text-lg font-semibold">{t.account.appearance.heading}</h3>
          <AppearanceSettings language={language} />
        </div>
        <div className="grid gap-2">
          <h3 className="font-display text-lg font-semibold">{t.account.install.heading}</h3>
          <p className="text-muted">{t.account.install.intro}</p>
          <InstallSettings language={language} />
        </div>
        {profile.couple_id && (
          <div className="grid gap-2">
            <h3 className="font-display text-lg font-semibold">{t.account.notifications.heading}</h3>
            <p className="text-muted">{t.account.notifications.intro}</p>
            <NotificationSettings vapidKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || null} language={language} />
          </div>
        )}
      </section>

      <div className="border-t border-line pt-6">
        <SignOutButton language={language} />
      </div>
    </div>
  );
}
