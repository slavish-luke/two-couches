/** Titles and "who can watch it" rules. Pure functions, safe in server and client code. */

export type MediaType = "movie" | "tv";

export type TitleRef = { media_type: MediaType; tmdb_id: number };

export function isMediaType(value: unknown): value is MediaType {
  return value === "movie" || value === "tv";
}

export function titleKey(ref: TitleRef) {
  return `${ref.media_type}:${ref.tmdb_id}`;
}

export function titleHref(ref: TitleRef) {
  return `/title/${ref.media_type}/${ref.tmdb_id}`;
}

/** A TMDB image at one of its fixed widths. Served straight from TMDB, so use with `unoptimized`. */
export function tmdbImage(path: string, size: "w92" | "w185" | "w342" | "w500") {
  return `https://image.tmdb.org/t/p/${size}${path}`;
}

/** flatrate = subscription. TMDB's other kinds: free, ads (free with ads), rent, buy. */
export type ProviderKind = "flatrate" | "free" | "ads" | "rent" | "buy";

export type Provider = {
  provider_id: number;
  name: string;
  logo_path: string | null;
  kind: ProviderKind;
  display_priority: number;
};

/** Where a title is offered in one country, as of `checked_at`. */
export type CountryAvailability = { providers: Provider[]; link: string | null; checked_at: string };

/** Availability by country code. A missing country means it couldn't be checked. */
export type Availability = Record<string, CountryAvailability | undefined>;

export type Watcher = { country: string; services: number[] };

/** Subscription services carrying the title in this person's country that they pay for. */
export function streamableFor(person: Watcher, availability: Availability) {
  return (availability[person.country]?.providers ?? []).filter(
    (p) => p.kind === "flatrate" && person.services.includes(p.provider_id),
  );
}

/** Free and free-with-ads services carrying the title in this person's country (no subscription needed). */
export function freeFor(person: Pick<Watcher, "country">, availability: Availability) {
  return (availability[person.country]?.providers ?? []).filter((p) => p.kind === "free" || p.kind === "ads");
}

function isFreeIn(country: string, availability: Availability) {
  return freeFor({ country }, availability).length > 0;
}

export type Verdict = "both" | "me" | "partner" | "free" | "none";

/**
 * "both": each of us has it on a subscription we pay for, in our own country. "me" also covers having no
 * partner yet. "free": neither of us can stream it, but it's free (or free with ads) in every country
 * involved. Rent and buy never count.
 */
export function whoCanWatch(me: Watcher, partner: Watcher | null, availability: Availability) {
  const mine = streamableFor(me, availability);
  const theirs = partner ? streamableFor(partner, availability) : [];

  let verdict: Verdict = "none";
  if (mine.length > 0 && theirs.length > 0) verdict = "both";
  else if (mine.length > 0) verdict = "me";
  else if (theirs.length > 0) verdict = "partner";
  else if (isFreeIn(me.country, availability) && (!partner || isFreeIn(partner.country, availability))) {
    verdict = "free";
  }
  return { verdict, mine, theirs };
}
