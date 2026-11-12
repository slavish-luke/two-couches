import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getMyFeedCreatedAt } from "@/app/calendar/feed";
import { CalendarSubscribe } from "@/app/calendar/subscribe";
import { Couches } from "@/components/couch";
import { ArrowIcon, PlusIcon } from "@/components/icons";
import { ListSync } from "@/components/list-sync";
import { WatchNightsSkeleton } from "./skeleton";
import { getI18n, localisedTitle } from "@/lib/i18n/server";
import { formatDayLong } from "@/lib/night-rules";
import { getProposals, getWatchNights, type WatchNight } from "@/lib/nights";
import { proposalView } from "@/lib/planning-rules";
import { dateLocale, isCountry } from "@/lib/places";
import { getPartner, requireProfile } from "@/lib/session";
import { tmdbLocale } from "@/lib/tmdb";
import { NightCard } from "./night-card";
import { ProposalCard } from "./proposal-card";

export const generateMetadata = localisedTitle("watchNights");

export default function WatchNightsPage() {
  return (
    <Suspense fallback={<WatchNightsSkeleton />}>
      <WatchNights />
    </Suspense>
  );
}

async function WatchNights() {
  const [profile, partner, { language, t }] = await Promise.all([requireProfile(), getPartner(), getI18n()]);
  if (!isCountry(profile.country)) redirect("/settings?welcome=1");
  if (!profile.couple_id) redirect("/couple");

  const locale = tmdbLocale(profile.language, profile.home_country ?? profile.country);
  const locales = partner?.country ? [locale, tmdbLocale(partner.language, partner.home_country)] : [locale];
  const [upcoming, past, feedCreatedAt, proposals] = await Promise.all([
    getWatchNights(profile.couple_id, locales),
    getWatchNights(profile.couple_id, locales, { past: true, limit: 5 }),
    getMyFeedCreatedAt(profile.id),
    getProposals(profile.couple_id, locales),
  ]);
  const feedMadeOn =
    feedCreatedAt &&
    new Intl.DateTimeFormat(dateLocale(language), {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: profile.time_zone,
    }).format(
      new Date(feedCreatedAt),
    );
  const now = new Date();
  const me = { id: profile.id, name: t.common.you, timeZone: profile.time_zone };
  const them = partner && { id: partner.id, name: partner.display_name || t.common.yourPartner, timeZone: partner.time_zone };
  // Times your partner suggested (to pick from) first, then your own.
  const suggested = proposals
    .flatMap((proposal) => {
      const view = proposalView(proposal, profile.id, now);
      return view === "hidden" ? [] : [{ proposal, view }];
    })
    .sort((a, b) => Number(b.view === "answer") - Number(a.view === "answer"));

  // Upcoming nights grouped by day, on your own calendar.
  const days = new Map<string, WatchNight[]>();
  for (const night of upcoming) {
    const day = formatDayLong(new Date(night.starts_at), profile.time_zone, language);
    days.set(day, [...(days.get(day) ?? []), night]);
  }

  return (
    <div className="grid gap-10">
      <ListSync coupleId={profile.couple_id} />
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div className="grid max-w-[34rem] gap-3">
          <h1 className="display -rotate-1 text-[clamp(2.4rem,5vw,3.6rem)]">{t.nights.heading}</h1>
          <p className="font-medium text-muted">{t.nights.intro}</p>
        </div>
        <Link href="/watch-nights/new" className="btn">
          <PlusIcon className="size-5 [stroke-width:3]" />
          {t.nights.plan}
        </Link>
      </div>

      {suggested.length > 0 && (
        <section className="grid gap-5">
          <h2 className="display text-[2rem]">{t.nights.proposal.section}</h2>
          <ul className="grid gap-5">
            {suggested.map(({ proposal, view }) => (
              <ProposalCard
                key={proposal.id}
                proposal={proposal}
                view={view}
                me={me}
                partner={them}
                now={now.getTime()}
                language={language}
              />
            ))}
          </ul>
        </section>
      )}

      <section className="grid gap-5">
        <h2 className="display text-[2rem]">{t.nights.upcoming}</h2>
        {upcoming.length === 0 ? (
          <div className="card grid justify-items-center gap-4 py-10 text-center">
            <Couches size={56} />
            <p className="max-w-[28rem] text-lg font-bold">{t.nights.empty}</p>
            <Link href="/watch-nights/new" className="btn">
              <PlusIcon className="size-5 [stroke-width:3]" />
              {t.nights.plan}
            </Link>
          </div>
        ) : (
          [...days].map(([day, nights]) => (
            <div key={day} className="grid gap-3">
              <h3 className="display-ink text-xl">{day}</h3>
              <ul className="grid gap-5">
                {nights.map((night) => (
                  <NightCard
                    key={night.id}
                    night={night}
                    me={me}
                    partner={them}
                    now={now}
                    language={language}
                    t={t}
                    listing
                  />
                ))}
              </ul>
            </div>
          ))
        )}
      </section>

      <CalendarSubscribe madeOn={feedMadeOn} language={language} />

      {past.length > 0 && (
        <section className="grid gap-4">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
            <h2 className="display text-[2rem]">{t.nights.past}</h2>
            {/* Sprint 22: every night you've had, as a timeline. */}
            <Link href="/watch-nights/all" className="group tap-area inline-flex items-center gap-1.5 font-bold underline underline-offset-4">
              {t.time.timeline.link}
              <ArrowIcon className="size-4 transition-transform duration-200 ease-(--ease-spring) group-hover:translate-x-1" />
            </Link>
          </div>
          {/* Nights that are over: flat paper, no shadow, so they sit back behind what's coming. */}
          <ul className="grid gap-3">
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
                listing
                className="paper rounded-panel border-[3px] border-outline/70 p-4"
              />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
