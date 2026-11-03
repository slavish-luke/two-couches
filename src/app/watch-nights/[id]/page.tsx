import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { ListSync } from "@/components/list-sync";
import { PageLoading } from "@/components/page-loading";
import { getI18n, localisedTitle } from "@/lib/i18n/server";
import { zonedParts } from "@/lib/night-rules";
import { getWatchNight, titleOptions } from "@/lib/nights";
import { isCountry } from "@/lib/places";
import { getPartner, requireProfile } from "@/lib/session";
import { tmdbLocale } from "@/lib/tmdb";
import { titleKey } from "@/lib/watch";
import { NightForm } from "../night-form";

export const generateMetadata = localisedTitle("changeNight");

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function EditWatchNightPage({ params }: PageProps<"/watch-nights/[id]">) {
  return (
    <Suspense fallback={<PageLoading />}>
      <EditWatchNight params={params} />
    </Suspense>
  );
}

async function EditWatchNight({ params }: Pick<PageProps<"/watch-nights/[id]">, "params">) {
  const [{ id }, profile, partner, { language, t }] = await Promise.all([
    params,
    requireProfile(),
    getPartner(),
    getI18n(),
  ]);
  if (!UUID.test(id)) notFound();
  if (!isCountry(profile.country)) redirect("/settings?welcome=1");
  if (!profile.couple_id) redirect("/couple");

  const locale = tmdbLocale(profile.language, profile.country);
  const locales = partner?.country ? [locale, tmdbLocale(partner.language, partner.country)] : [locale];
  const [night, options] = await Promise.all([getWatchNight(id, locales), titleOptions(profile.couple_id, locales)]);
  if (!night) notFound();

  // Shown as it is on your own clock.
  const start = zonedParts(new Date(night.starts_at), profile.time_zone);
  const key = night.title ? titleKey(night.title) : "";
  const extra = night.title && !options.some((o) => o.key === key) ? { key, title: night.title.title } : null;

  return (
    <div className="grid gap-6">
      <ListSync coupleId={profile.couple_id} />
      <div className="grid gap-2">
        <Link href="/watch-nights" className="text-sm font-semibold text-muted hover:text-ink">
          {t.nights.form.back}
        </Link>
        <h1 className="font-display text-3xl font-bold tracking-tight">{t.nights.form.editHeading}</h1>
      </div>
      <NightForm
        // A change saved on the other screen arrives through ListSync; start again from it.
        key={`${night.id}:${night.starts_at}:${key}:${night.method}`}
        nightId={night.id}
        initial={{
          title: key,
          date: start.date,
          time: start.time,
          method: night.method,
          link: night.link ?? "",
          syncplay_server: night.syncplay_server ?? "",
          syncplay_room: night.syncplay_room ?? "",
          notes: night.notes,
        }}
        options={options}
        extra={extra}
        me={{ name: t.common.you, timeZone: profile.time_zone }}
        partner={partner && { name: partner.display_name || t.common.yourPartner, timeZone: partner.time_zone }}
        now={new Date().toISOString()}
        language={language}
      />
    </div>
  );
}
