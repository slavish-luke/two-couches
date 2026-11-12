import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { BackIcon } from "@/components/icons";
import { getI18n, localisedTitle } from "@/lib/i18n/server";
import { getListItem } from "@/lib/list";
import { episodeAfter, type Progress } from "@/lib/list-rules";
import { formatDay, formatTime } from "@/lib/night-rules";
import { getWatchNight } from "@/lib/nights";
import { subtitlesConfigured } from "@/lib/opensubtitles";
import { isCountry } from "@/lib/places";
import { getPartner, requireProfile } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { tmdbLocale } from "@/lib/tmdb";
import { WatchRoomSkeleton } from "./skeleton";
import { WatchRoom } from "./watch-room";

export const generateMetadata = localisedTitle("watchRoom");

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The watch room: each of you opens your own copy of the night's file in the browser, and play, pause and
 * skips stay in step between your two screens (see <WatchRoom>). Open for any of the couple's nights.
 */
export default function WatchRoomPage({ params }: PageProps<"/watch-nights/[id]/watch">) {
  return (
    <Suspense fallback={<WatchRoomSkeleton />}>
      <Room params={params} />
    </Suspense>
  );
}

async function Room({ params }: Pick<PageProps<"/watch-nights/[id]/watch">, "params">) {
  const [{ id }, profile, partner, { language, t }] = await Promise.all([
    params,
    requireProfile(),
    getPartner(),
    getI18n(),
  ]);
  if (!UUID.test(id)) notFound();
  if (!isCountry(profile.country)) redirect("/settings?welcome=1");
  if (!profile.couple_id) redirect("/couple");

  const locale = tmdbLocale(profile.language, profile.home_country ?? profile.country);
  const night = await getWatchNight(id, [locale]);
  if (!night) notFound();
  const start = new Date(night.starts_at);
  const text = t.nights.room;

  // A series night looks for subtitles for the next episode on your list (season 1, episode 1 if none).
  let episode: Progress | null = null;
  // On the list, the room also offers the next episode when one ends (Sprint 23), from the one up next.
  let series: { playing: Progress; seasonEpisodes: number[] | null } | null = null;
  if (night.title?.media_type === "tv") {
    const supabase = await createClient();
    const [item, counts] = await Promise.all([
      getListItem(profile.couple_id, night.title),
      supabase.from("titles").select("season_episodes").eq("media_type", "tv").eq("tmdb_id", night.title.tmdb_id).maybeSingle(),
    ]);
    const progress = item?.season && item.episode ? { season: item.season, episode: item.episode } : null;
    const seasonEpisodes = counts.data?.season_episodes ?? null;
    const upNext = episodeAfter(progress, seasonEpisodes);
    episode = upNext ?? progress ?? { season: 1, episode: 1 };
    if (item && upNext) series = { playing: upNext, seasonEpisodes };
  }

  return (
    <div data-wide className="grid gap-6">
      <div className="grid gap-3">
        <Link href="/watch-nights" className="group inline-flex items-center gap-1.5 justify-self-start font-bold underline underline-offset-4">
          <BackIcon className="size-4 transition-transform duration-200 ease-(--ease-spring) group-hover:-translate-x-1" /> {text.back}
        </Link>
        <h1 className="display -rotate-1 text-[clamp(2.4rem,5vw,3.6rem)]">{text.heading}</h1>
        <p className="font-medium text-muted">
          <span className="font-bold">{night.title?.title ?? t.nights.noTitle}</span>
          {" · "}
          {formatDay(start, profile.time_zone, language)}, {formatTime(start, profile.time_zone, language)}
        </p>
      </div>
      <WatchRoom
        nightId={night.id}
        me={{ id: profile.id, name: t.common.you }}
        partner={partner && { id: partner.id, name: partner.display_name || t.common.yourPartner }}
        language={language}
        finder={{ enabled: subtitlesConfigured(), episode }}
        series={series}
      />
    </div>
  );
}
