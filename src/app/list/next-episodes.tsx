import Link from "next/link";
import { Suspense } from "react";
import { CheckIcon } from "@/components/icons";
import { Poster } from "@/components/poster";
import { NBSP, SkelPoster, SkelText } from "@/components/skeleton";
import { getEpisodeGuides, getWatchingSeries } from "@/lib/diary";
import { EPISODE_CHIP_DAYS, nextUp, orderNextUp, type EpisodeGuide, type NextUp } from "@/lib/diary-rules";
import { getMessages, type Messages } from "@/lib/i18n";
import { getI18n } from "@/lib/i18n/server";
import { localDate, type Progress } from "@/lib/list-rules";
import { getPartner, requireProfile } from "@/lib/session";
import { tmdbLocale } from "@/lib/tmdb";
import { titleHref } from "@/lib/watch";

/**
 * Home's "Next episodes": the next episode of each series you're watching, "ready to watch" or "new episode
 * in 2 d", ready ones first. Self-contained: nothing shows unless you're watching a series; the heading
 * comes first and the cards (which need TMDB) stream in under it.
 */
export function NextEpisodes() {
  return (
    <Suspense>
      <WatchingSeries />
    </Suspense>
  );
}

async function WatchingSeries() {
  const [profile, partner, { t }] = await Promise.all([requireProfile(), getPartner(), getI18n()]);
  if (!profile.couple_id || !profile.home_country) return null;
  const mine = tmdbLocale(profile.language, profile.home_country);
  const locales = partner?.home_country ? [mine, tmdbLocale(partner.language, partner.home_country)] : [mine];
  const series = await getWatchingSeries(profile.couple_id, locales);
  if (series.length === 0) return null;

  return (
    <section data-next-episodes aria-labelledby="next-episodes" className="mb-4 grid gap-1">
      <h2 id="next-episodes" className="display text-[2rem]">
        {t.diary.next.heading}
      </h2>
      <Suspense fallback={<NextEpisodesSkeleton count={series.length} />}>
        <Row series={series} today={localDate(profile.time_zone)} language={profile.language} />
      </Suspense>
    </section>
  );
}

/** The scroller: room below for the cards' shadows and hover lift, which it would otherwise clip. */
const ROW = "-mx-4 flex snap-x scroll-px-4 gap-4 overflow-x-auto px-4 pb-4 pt-2";
const CARD = "w-[16.5rem] shrink-0 snap-start";

async function Row(props: {
  series: Awaited<ReturnType<typeof getWatchingSeries>>;
  today: string;
  language: string;
}) {
  const t = getMessages(props.language);
  const guides = await getEpisodeGuides(props.series.map((s) => s.tmdb_id));
  const rows = orderNextUp(
    props.series.flatMap((s) => {
      const guide = guides[s.tmdb_id];
      const next = guide && nextUp(s.progress, guide, props.today);
      return next ? [{ ...s, next }] : [];
    }),
  );

  if (rows.length === 0) return <p className="pt-1 font-medium text-muted">{t.diary.next.caughtUp}</p>;
  return (
    <ul className={ROW}>
      {rows.map((row) => {
        const episode = t.common.progress(row.next.episode.season, row.next.episode.episode);
        const state = nextUpText(row.next, t);
        return (
          <li key={row.id} className={CARD}>
            <Link
              href={titleHref(row)}
              aria-label={t.diary.next.label(row.title, episode, state)}
              className="card group grid h-full grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 p-2.5 transition duration-150 ease-(--ease-spring) hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[8px_8px_0_var(--outline)]"
            >
              <Poster path={row.poster_path} title={row.title} size="xs" language={props.language} />
              <span aria-hidden className="grid min-w-0 content-center justify-items-start gap-1">
                <span data-item-title className="max-w-full truncate font-bold leading-tight group-hover:underline">
                  {row.title}
                </span>
                <span className="text-[15px] font-semibold leading-tight">{episode}</span>
                <EpisodeState next={row.next} t={t} />
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function nextUpText(next: NextUp, t: Messages) {
  return next.state === "ready" ? t.diary.next.ready : t.diary.next.soon(next.days);
}

/** "Ready to watch" (with a tick, on the accent's soft tint) or "New episode in 2 d" (on paper). */
export function EpisodeState({ next, t }: { next: NextUp; t: Messages }) {
  return (
    <span
      data-episode-state={next.state}
      className={`inline-flex max-w-full items-center gap-1 rounded-full border-2 border-outline px-2 text-[13px] font-bold leading-snug ${next.state === "ready" ? "bg-accent-soft" : "bg-surface"}`}
    >
      {next.state === "ready" && <CheckIcon className="size-3.5" />}
      <span className="truncate">{nextUpText(next, t)}</span>
    </span>
  );
}

/**
 * The chip on a Home list card for a series you're watching: "New episode in 2 d" while the next episode
 * is due within EPISODE_CHIP_DAYS. Nothing otherwise (Next episodes says when one is ready).
 */
export async function EpisodeChip(props: {
  guides: Promise<Record<number, EpisodeGuide>>;
  tmdbId: number;
  progress: Progress | null;
  today: string;
  language: string;
}) {
  const guide = (await props.guides)[props.tmdbId];
  const next = guide && nextUp(props.progress, guide, props.today);
  if (!next || next.state !== "soon" || next.days > EPISODE_CHIP_DAYS) return null;
  return <EpisodeState next={next} t={getMessages(props.language)} />;
}

/** The row while TMDB answers: a card per series (at most four), the same size as the real ones. */
function NextEpisodesSkeleton({ count }: { count: number }) {
  return (
    <ul aria-busy className={ROW}>
      {Array.from({ length: Math.min(count, 4) }, (_, i) => (
        <li key={i} aria-hidden className={CARD}>
          <div className="card grid h-full grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 p-2.5">
            <SkelPoster size="xs" />
            <span className="grid min-w-0 content-center justify-items-start gap-1">
              <SkelText className="font-bold leading-tight" width="85%" />
              <SkelText className="text-[15px] font-semibold leading-tight" width="40%" />
              <span className="w-24 rounded-full border-2 border-outline bg-surface px-2 text-[13px] font-bold leading-snug">{NBSP}</span>
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}
