import "server-only";
import { batchPages, discoverTitles, getGenres, popularIn, trendingTitles } from "./browse";
import { localDate } from "./list-rules";
import { isCountry } from "./places";
import { FOR_YOU_CHECKED, getForYou } from "./recommend";
import type { getPartner, Profile } from "./session";
import { getAvailability } from "./titles";
import { tmdbLocale } from "./tmdb";
import { cinemaReleases, digitalReleases, releaseDates } from "./upcoming";
import type { MediaType, Watcher } from "./watch";

type Partner = Awaited<ReturnType<typeof getPartner>>;

/**
 * Fills the caches behind the pages that wait longest on TMDB when cold, so opening them later is quick:
 * Browse as it opens (films, then series: the grid, the rows and For you) and Coming soon's films. Asks
 * for exactly what those pages ask for, since a cache entry only helps the same request. Runs as the
 * signed-in user, after <WarmUp> calls /api/warm. Each step runs on when another fails.
 */
export async function warmCaches(profile: Profile, partner: Partner) {
  if (!isCountry(profile.country)) return;
  const locale = tmdbLocale(profile.language, profile.home_country ?? profile.country);
  const locales = partner?.country ? [locale, tmdbLocale(partner.language, partner.home_country)] : [locale];
  const me: Watcher = { country: profile.country, services: profile.services };
  const them: Watcher | null = partner?.country ? { country: partner.country, services: partner.services } : null;
  const countries = them ? [me.country, them.country] : [me.country];

  /** Browse with no filters: "we can both watch" is on whenever there's a partner. */
  const browse = async (type: MediaType) => {
    const grid = batchPages(1, them ? true : null).map((page) =>
      discoverTitles({ ...popularIn(type, me.country), providers: me.services, page }, locale).then((p) => p.results),
    );
    const rows = [
      trendingTitles(type, locale),
      discoverTitles({ ...popularIn(type, me.country), page: 1 }, locale).then((p) => p.results),
      ...(them && them.country !== me.country
        ? [discoverTitles({ ...popularIn(type, them.country), page: 1 }, locale).then((p) => p.results)]
        : []),
    ];
    const [titles] = await Promise.all([Promise.allSettled([...grid, ...rows]), getGenres(type, locale)]);
    await getAvailability(
      titles.flatMap((t) => (t.status === "fulfilled" ? t.value : [])),
      countries,
    );
    if (profile.couple_id) {
      const forYou = await getForYou(profile.couple_id, type, locales, localDate(profile.time_zone));
      await getAvailability(forYou.suggestions.slice(0, FOR_YOU_CHECKED), countries);
    }
  };

  /** Coming soon's Films tab: cinema and digital releases in each country, with their dates. */
  const comingSoon = async () => {
    const regions = [...new Set(countries)];
    const lists = await Promise.allSettled(
      regions.flatMap((region) => [cinemaReleases(region, locale), digitalReleases(region, locale)]),
    );
    const ids = lists.flatMap((l) => (l.status === "fulfilled" ? l.value.map((r) => r.tmdb_id) : []));
    await releaseDates([...new Set(ids)], regions);
  };

  // One at a time, in the order they're likely to be opened: TMDB rate-limits bursts.
  for (const step of [() => browse("movie"), comingSoon, () => browse("tv")]) {
    await step().catch((error) => console.error("Warming caches failed", error));
  }
}
