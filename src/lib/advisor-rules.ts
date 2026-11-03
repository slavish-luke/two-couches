/**
 * The subscription advisor: what another service would unlock on the Up next list, and which services you
 * pay for carry nothing on it. Pure functions, safe in server and client code. Builds on whoCanWatch(),
 * run with a hypothetical services list, so "watchable" means exactly what the badges mean.
 */
import { titleKey, whoCanWatch, type Availability, type TitleRef, type Watcher } from "./watch";

export type AdvisorTitle = TitleRef & { title: string; poster_path: string | null };

export type ServiceAdvice = {
  provider_id: number;
  name: string;
  logo_path: string | null;
  /** Titles you'd both be able to watch with it that you can't both watch today. */
  forBoth: AdvisorTitle[];
  /** Titles you'd be able to stream with it that you can't stream today. Includes every forBoth title. */
  forYou: AdvisorTitle[];
};

export type Advice = {
  /** The services worth adding, most useful first: most titles for both, then most for you. */
  suggestions: ServiceAdvice[];
  /**
   * Provider IDs you pay for that carry none of the titles in your country. Empty unless every title
   * could be checked there, so a failed check never claims a service is unused.
   */
  idle: number[];
};

export const SUGGESTION_LIMIT = 5;

/**
 * For each subscription service in your country that you don't pay for and that carries at least one of
 * `titles`, what adding it would unlock. `byTitle` is getAvailability() output for both countries.
 */
export function adviseServices(
  titles: AdvisorTitle[],
  me: Watcher,
  partner: Watcher | null,
  byTitle: Record<string, Availability>,
  limit = SUGGESTION_LIMIT,
): Advice {
  const candidates = new Map<number, ServiceAdvice>();
  const carried = new Set<number>();
  let allChecked = true;

  for (const title of titles) {
    const availability = byTitle[titleKey(title)] ?? {};
    const here = availability[me.country];
    if (!here) {
      allChecked = false;
      continue;
    }
    const today = whoCanWatch(me, partner, availability);
    for (const provider of here.providers) {
      if (provider.kind !== "flatrate") continue;
      carried.add(provider.provider_id);
      if (me.services.includes(provider.provider_id)) continue;

      let advice = candidates.get(provider.provider_id);
      if (!advice) {
        advice = { provider_id: provider.provider_id, name: provider.name, logo_path: provider.logo_path, forBoth: [], forYou: [] };
        candidates.set(provider.provider_id, advice);
      }
      const withIt = whoCanWatch({ ...me, services: [...me.services, provider.provider_id] }, partner, availability);
      if (today.mine.length === 0 && withIt.mine.length > 0) advice.forYou.push(title);
      if (today.verdict !== "both" && withIt.verdict === "both") advice.forBoth.push(title);
    }
  }

  const suggestions = [...candidates.values()]
    .filter((a) => a.forYou.length > 0)
    .sort(
      (a, b) =>
        b.forBoth.length - a.forBoth.length || b.forYou.length - a.forYou.length || a.name.localeCompare(b.name),
    )
    .slice(0, limit);
  const idle = titles.length > 0 && allChecked ? me.services.filter((id) => !carried.has(id)) : [];
  return { suggestions, idle };
}

/** The titles to show as posters for a suggestion: the ones for both of you first, then the rest. */
export function showcase(advice: ServiceAdvice, count: number) {
  const both = new Set(advice.forBoth.map(titleKey));
  return [...advice.forBoth, ...advice.forYou.filter((t) => !both.has(titleKey(t)))].slice(0, count);
}
