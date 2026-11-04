import Link from "next/link";
import { BackIcon } from "@/components/icons";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { PageLoading } from "@/components/page-loading";
import { getI18n, localisedTitle } from "@/lib/i18n/server";
import { suggestStart } from "@/lib/night-rules";
import { titleOptions } from "@/lib/nights";
import { isCountry } from "@/lib/places";
import { getPartner, requireProfile } from "@/lib/session";
import { getTitle } from "@/lib/titles";
import { tmdbLocale } from "@/lib/tmdb";
import { isMediaType, titleKey, type TitleRef } from "@/lib/watch";
import { NightForm, type TitleOption } from "../night-form";

export const generateMetadata = localisedTitle("planNight");

export default function NewWatchNightPage({ searchParams }: PageProps<"/watch-nights/new">) {
  return (
    <Suspense fallback={<PageLoading />}>
      <NewWatchNight searchParams={searchParams} />
    </Suspense>
  );
}

/** Opened from a title page (`?type=movie&id=603`), the form starts with that title picked. */
async function NewWatchNight({ searchParams }: Pick<PageProps<"/watch-nights/new">, "searchParams">) {
  const [profile, partner, params, { language, t }] = await Promise.all([
    requireProfile(),
    getPartner(),
    searchParams,
    getI18n(),
  ]);
  if (!isCountry(profile.country)) redirect("/settings?welcome=1");
  if (!profile.couple_id) redirect("/couple");

  const locale = tmdbLocale(profile.language, profile.home_country ?? profile.country);
  const locales = partner?.country ? [locale, tmdbLocale(partner.language, partner.home_country)] : [locale];
  const id = Number(params.id);
  const ref: TitleRef | null =
    isMediaType(params.type) && Number.isSafeInteger(id) && id > 0 ? { media_type: params.type, tmdb_id: id } : null;

  const options = await titleOptions(profile.couple_id, locales);
  let extra: TitleOption | null = null;
  if (ref && !options.some((o) => o.key === titleKey(ref))) {
    const title = await getTitle(ref, locale).catch(() => null);
    if (title) extra = { key: titleKey(ref), title: title.title };
  }

  const now = new Date();
  const zones = partner ? [profile.time_zone, partner.time_zone] : [profile.time_zone];
  const start = suggestStart(now, zones, profile.time_zone);
  const picked = ref && (extra || options.some((o) => o.key === titleKey(ref))) ? titleKey(ref) : "";

  return (
    <div className="grid gap-6">
      <div className="grid gap-3">
        <Link href="/watch-nights" className="group inline-flex items-center gap-1.5 justify-self-start font-bold underline underline-offset-4">
          <BackIcon className="size-4 transition-transform duration-200 ease-(--ease-spring) group-hover:-translate-x-1" /> {t.nights.form.back}
        </Link>
        <h1 className="display -rotate-1 text-[clamp(2.4rem,5vw,3.6rem)]">{t.nights.form.newHeading}</h1>
      </div>
      <NightForm
        nightId={null}
        initial={{ title: picked, ...start, method: null, link: "", syncplay_server: "", syncplay_room: "", notes: "" }}
        options={options}
        extra={extra}
        me={{ name: t.common.you, timeZone: profile.time_zone }}
        partner={partner && { name: partner.display_name || t.common.yourPartner, timeZone: partner.time_zone }}
        now={now.toISOString()}
        language={language}
      />
    </div>
  );
}
