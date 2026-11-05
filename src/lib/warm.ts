import "server-only";
import { batchPages, discoverTitles, getGenres, popularIn, trendingTitles } from "./browse";
import { localDate } from "./list-rules";
import { isCountry } from "./places";
import { FOR_YOU_CHECKED, getForYou } from "./recommend";
import type { getPartner, Profile } from "./session";
import { createClient } from "./supabase/server";
import { getAvailability, getTitle, settleLimited } from "./titles";
import { tmdbLocale } from "./tmdb";
import { cinemaReleases, digitalReleases, releaseDates } from "./upcoming";
import type { MediaType, TitleRef, Watcher } from "./watch";

type Partner = Awaited<ReturnType<typeof getPartner>>;

/** How many Up next titles have their title page warmed: the ones being watched first, then the newest. */
const UP_NEXT_WARMED = 30;

/**
 * What a title page fetches for one title (src/app/title/[type]/[id]/page.tsx), so opening it from the
 * list is quick: the title in the viewer's locale. Where to watch it is warmed for all of them at once in
 * warmCaches(). Anything else the title page starts fetching per title belongs here too.
 */
async function warmTitlePage(ref: TitleRef, view: { profile: Profile; locale: string }) {
  await Promise.all([getTitle(ref, view.locale)]);
}

/**
 * Fills the caches behind the pages that wait longest on TMDB when cold, so opening them later is quick:
 * the title pages of Up next titles, Browse as it opens (films, then series: the grid, the rows and For
 * you) and Coming soon's films. Asks for exactly what those pages ask for, since a cache entry only helps
 * the same request. Runs as the signed-in user, after <WarmUp> calls /api/warm. Each step runs on when
 * another fails.
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

  /** The title pages of what's Up next on the list (Home's first tab), in Home's order. */
  const upNext = async () => {
    if (!profile.couple_id) return;
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("list_items")
      .select("media_type, tmdb_id, status, created_at")
      .eq("couple_id", profile.couple_id)
      .in("status", ["watching", "want"]);
    if (error) throw error;
    const refs: TitleRef[] = data
      .sort((a, b) => Number(b.status === "watching") - Number(a.status === "watching") || b.created_at.localeCompare(a.created_at))
      .slice(0, UP_NEXT_WARMED)
      .map((row) => ({ media_type: row.media_type as MediaType, tmdb_id: row.tmdb_id }));
    await Promise.all([
      settleLimited(refs, 4, (ref) => warmTitlePage(ref, { profile, locale })),
      getAvailability(refs, countries),
    ]);
  };

  // One at a time, in the order they're likely to be opened: TMDB rate-limits bursts.
  for (const step of [upNext, () => browse("movie"), comingSoon, () => browse("tv")]) {
    await step().catch((error) => console.error("Warming caches failed", error));
  }
}
