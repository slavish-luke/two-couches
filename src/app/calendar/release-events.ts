import type { Messages } from "@/lib/i18n";
import type { IcsEvent } from "@/lib/night-rules";
import type { CountryReleases, NextEpisode } from "@/lib/upcoming";

// Sprint 19: list titles' release days and next episodes as all-day events in the calendar feed. Pure.

/** A film on the list, with its cinema and digital release dates in each of your countries (yours first). */
export type FeedFilm = { tmdb_id: number; title: string; releases: Record<string, CountryReleases> };

/** A series on the list, with its next announced episode. */
export type FeedSeries = { tmdb_id: number; title: string; next: NextEpisode };

/** The days the feed covers, as YYYY-MM-DD (inclusive): the same span as its watch nights. */
export type FeedWindow = { from: string; to: string };

/**
 * One all-day event per film, kind (cinema or digital) and date, naming every country with that date
 * ("Dune · in cinemas (GB, NZ)"). The UID is the film, kind and date, so it stays put while the date does
 * (a moved date is a new event; the old one drops out of the feed).
 */
export function releaseEvents(
  films: FeedFilm[],
  countries: string[],
  { t, window, origin }: { t: Messages; window: FeedWindow; origin: string },
): IcsEvent[] {
  return films.flatMap((film) =>
    (["cinema", "digital"] as const).flatMap((kind) => {
      const byDate = new Map<string, string[]>();
      for (const country of countries) {
        const date = film.releases[country]?.[kind];
        if (date && date >= window.from && date <= window.to) byDate.set(date, [...(byDate.get(date) ?? []), country]);
      }
      return [...byDate].map(([day, where]) => ({
        uid: `movie-${film.tmdb_id}-${kind}-${day}@two-couches`,
        day,
        summary: t.discovery.feed[kind](film.title, where.join(", ")),
        description: t.discovery.feed.releaseNote,
        url: `${origin}/title/movie/${film.tmdb_id}`,
      }));
    }),
  );
}

/** One all-day event per series for its next episode, on its air date ("Severance · S2 E5"). */
export function episodeEvents(
  series: FeedSeries[],
  { t, window, origin }: { t: Messages; window: FeedWindow; origin: string },
): IcsEvent[] {
  return series
    .filter((s) => s.next.air_date >= window.from && s.next.air_date <= window.to)
    .map((s) => ({
      uid: `tv-${s.tmdb_id}-s${s.next.season}e${s.next.episode}@two-couches`,
      day: s.next.air_date,
      summary: t.discovery.feed.episode(s.title, t.common.progress(s.next.season, s.next.episode)),
      description: t.discovery.feed.episodeNote,
      url: `${origin}/title/tv/${s.tmdb_id}`,
    }));
}
