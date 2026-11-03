import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getMyFeedCreatedAt } from "@/app/calendar/feed";
import { CalendarSubscribe } from "@/app/calendar/subscribe";
import { ListSync } from "@/components/list-sync";
import { PageLoading } from "@/components/page-loading";
import { getI18n, localisedTitle } from "@/lib/i18n/server";
import { formatDayLong } from "@/lib/night-rules";
import { getWatchNights, type WatchNight } from "@/lib/nights";
import { isCountry } from "@/lib/places";
import { getPartner, requireProfile } from "@/lib/session";
import { tmdbLocale } from "@/lib/tmdb";
import { NightCard } from "./night-card";

export const generateMetadata = localisedTitle("watchNights");

export default function WatchNightsPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <WatchNights />
    </Suspense>
  );
}

async function WatchNights() {
  const [profile, partner, { language, t }] = await Promise.all([requireProfile(), getPartner(), getI18n()]);
  if (!isCountry(profile.country)) redirect("/settings?welcome=1");
  if (!profile.couple_id) redirect("/couple");

  const locale = tmdbLocale(profile.language, profile.country);
  const locales = partner?.country ? [locale, tmdbLocale(partner.language, partner.country)] : [locale];
  const [upcoming, past, feedCreatedAt] = await Promise.all([
    getWatchNights(profile.couple_id, locales),
    getWatchNights(profile.couple_id, locales, { past: true, limit: 5 }),
    getMyFeedCreatedAt(profile.id),
  ]);
  const feedMadeOn =
    feedCreatedAt &&
    new Intl.DateTimeFormat(language, { day: "numeric", month: "short", year: "numeric", timeZone: profile.time_zone }).format(
      new Date(feedCreatedAt),
    );
  const now = new Date();
  const me = { id: profile.id, name: t.common.you, timeZone: profile.time_zone };
  const them = partner && { id: partner.id, name: partner.display_name || t.common.yourPartner, timeZone: partner.time_zone };

  // Upcoming nights grouped by day, on your own calendar.
  const days = new Map<string, WatchNight[]>();
  for (const night of upcoming) {
    const day = formatDayLong(new Date(night.starts_at), profile.time_zone, language);
    days.set(day, [...(days.get(day) ?? []), night]);
  }

  return (
    <div className="grid gap-8">
      <ListSync coupleId={profile.couple_id} />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="grid gap-2">
          <h1 className="font-display text-3xl font-bold tracking-tight">{t.nights.heading}</h1>
          <p className="text-muted">{t.nights.intro}</p>
        </div>
        <Link href="/watch-nights/new" className="btn">
          {t.nights.plan}
        </Link>
        <CalendarSubscribe madeOn={feedMadeOn} language={language} />
      </div>

      <section className="grid gap-4">
        <h2 className="font-display text-lg font-semibold">{t.nights.upcoming}</h2>
        {upcoming.length === 0 ? (
          <div className="card grid justify-items-center gap-1 py-12 text-center">
            <p className="text-sm text-muted">{t.nights.empty}</p>
            <Link href="/watch-nights/new" className="text-sm font-semibold text-partner">
              {t.nights.plan} →
            </Link>
          </div>
        ) : (
          [...days].map(([day, nights]) => (
            <div key={day} className="grid gap-2">
              <h3 className="text-sm font-semibold text-muted">{day}</h3>
              <ul className="grid gap-3">
                {nights.map((night) => (
                  <NightCard key={night.id} night={night} me={me} partner={them} now={now} language={language} t={t} />
                ))}
              </ul>
            </div>
          ))
        )}
      </section>

      {past.length > 0 && (
        <section className="grid gap-4">
          <h2 className="font-display text-lg font-semibold">{t.nights.past}</h2>
          <ul className="grid gap-3 opacity-80">
            {past.map((night) => (
              <NightCard
                key={night.id}
                night={night}
                me={me}
                partner={them}
                now={now}
                language={language}
                t={t}
                actions={false}
              />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
