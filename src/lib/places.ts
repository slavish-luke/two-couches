/** ISO 3166-1 alpha-2 codes. TMDB uses these as watch regions. */
export const COUNTRY_CODES = [
  "AD", "AE", "AF", "AG", "AI", "AL", "AM", "AO", "AQ", "AR", "AS", "AT", "AU", "AW", "AX", "AZ", "BA", "BB", "BD", "BE",
  "BF", "BG", "BH", "BI", "BJ", "BL", "BM", "BN", "BO", "BQ", "BR", "BS", "BT", "BV", "BW", "BY", "BZ", "CA", "CC", "CD",
  "CF", "CG", "CH", "CI", "CK", "CL", "CM", "CN", "CO", "CR", "CU", "CV", "CW", "CX", "CY", "CZ", "DE", "DJ", "DK", "DM",
  "DO", "DZ", "EC", "EE", "EG", "EH", "ER", "ES", "ET", "FI", "FJ", "FK", "FM", "FO", "FR", "GA", "GB", "GD", "GE", "GF",
  "GG", "GH", "GI", "GL", "GM", "GN", "GP", "GQ", "GR", "GS", "GT", "GU", "GW", "GY", "HK", "HM", "HN", "HR", "HT", "HU",
  "ID", "IE", "IL", "IM", "IN", "IO", "IQ", "IR", "IS", "IT", "JE", "JM", "JO", "JP", "KE", "KG", "KH", "KI", "KM", "KN",
  "KP", "KR", "KW", "KY", "KZ", "LA", "LB", "LC", "LI", "LK", "LR", "LS", "LT", "LU", "LV", "LY", "MA", "MC", "MD", "ME",
  "MF", "MG", "MH", "MK", "ML", "MM", "MN", "MO", "MP", "MQ", "MR", "MS", "MT", "MU", "MV", "MW", "MX", "MY", "MZ", "NA",
  "NC", "NE", "NF", "NG", "NI", "NL", "NO", "NP", "NR", "NU", "NZ", "OM", "PA", "PE", "PF", "PG", "PH", "PK", "PL", "PM",
  "PN", "PR", "PS", "PT", "PW", "PY", "QA", "RE", "RO", "RS", "RU", "RW", "SA", "SB", "SC", "SD", "SE", "SG", "SH", "SI",
  "SJ", "SK", "SL", "SM", "SN", "SO", "SR", "SS", "ST", "SV", "SX", "SY", "SZ", "TC", "TD", "TF", "TG", "TH", "TJ", "TK",
  "TL", "TM", "TN", "TO", "TR", "TT", "TV", "TW", "TZ", "UA", "UG", "UM", "US", "UY", "UZ", "VA", "VC", "VE", "VG", "VI",
  "VN", "VU", "WF", "WS", "YE", "YT", "ZA", "ZM", "ZW",
] as const;

export type Country = (typeof COUNTRY_CODES)[number];

export const LANGUAGES = {
  en: "English",
  tr: "Türkçe",
} as const;

export type Language = keyof typeof LANGUAGES;

const countrySet = new Set<string>(COUNTRY_CODES);

export function isCountry(value: unknown): value is Country {
  return typeof value === "string" && countrySet.has(value);
}

export function isLanguage(value: unknown): value is Language {
  return typeof value === "string" && value in LANGUAGES;
}

/** Every IANA time zone the runtime knows, e.g. "Europe/Paris". */
export function allTimeZones(): string[] {
  return Intl.supportedValuesOf("timeZone");
}

export function isTimeZone(value: unknown): value is string {
  if (typeof value !== "string" || !value) return false;
  try {
    new Intl.DateTimeFormat("en", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

/** Countries sorted by their name in the given UI language. */
export function countryOptions(language: string) {
  const names = new Intl.DisplayNames([language], { type: "region" });
  return COUNTRY_CODES.map((code) => ({ code, name: names.of(code) ?? code })).sort((a, b) =>
    a.name.localeCompare(b.name, language),
  );
}

export function countryName(code: string, language: string) {
  return new Intl.DisplayNames([language], { type: "region" }).of(code) ?? code;
}

/** "Sat 8:00 pm" in the given zone. */
/** Minutes ahead of UTC in a time zone at this moment, e.g. 180 for "GMT+03:00". */
function utcOffsetMinutes(date: Date, timeZone: string) {
  const name = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "longOffset" })
    .formatToParts(date)
    .find((part) => part.type === "timeZoneName")?.value;
  const match = name?.match(/GMT([+-])(\d{2}):(\d{2})/);
  if (!match) return 0;
  return (match[1] === "-" ? -1 : 1) * (Number(match[2]) * 60 + Number(match[3]));
}

/** How many hours apart two clocks are right now (can be fractional, e.g. 6.5), always positive. */
export function hoursApart(date: Date, zoneA: string, zoneB: string) {
  return Math.abs(utcOffsetMinutes(date, zoneA) - utcOffsetMinutes(date, zoneB)) / 60;
}

export function formatLocalTime(date: Date, timeZone: string, language: string) {
  return new Intl.DateTimeFormat(language, {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  }).format(date);
}

/** Someone's place, as stored on their profile: home country plus an optional visit. */
export type PlaceFields = {
  country: string | null;
  visiting_country: string | null;
  /** Last day of the visit, inclusive, in the person's own time zone (YYYY-MM-DD). */
  visiting_until: string | null;
  time_zone: string;
};

export type Visit = { country: string; until: string };

/** Today's date (YYYY-MM-DD) in a time zone. */
function dateIn(timeZone: string, now: Date) {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone }).format(now);
}

/**
 * The visit in force now, or null. A visit counts until the end of its "until" day in the visitor's own
 * zone, only once they have a home country, and only when it's somewhere other than home.
 */
export function activeVisit(person: PlaceFields, now = new Date()): Visit | null {
  const { country, visiting_country: visiting, visiting_until: until } = person;
  if (!country || !visiting || !until || visiting === country) return null;
  return dateIn(person.time_zone, now) <= until ? { country: visiting, until } : null;
}

/** "20 Dec" for a visit's last day, with the year when it isn't this year. */
export function formatVisitDate(until: string, language: string, now = new Date()) {
  const sameYear = until.slice(0, 4) === String(now.getUTCFullYear());
  return new Intl.DateTimeFormat(language, {
    day: "numeric",
    month: "short",
    year: sameYear ? undefined : "numeric",
    timeZone: "UTC",
  }).format(new Date(`${until}T00:00:00Z`));
}

/** The longest visit the settings form accepts, in days from today. */
export const MAX_VISIT_DAYS = 366;

/** The first and last "until" dates a new visit may have, in the visitor's zone: today to a year ahead. */
export function visitDateRange(timeZone: string, now = new Date()) {
  const today = dateIn(timeZone, now);
  const last = new Date(`${today}T00:00:00Z`);
  last.setUTCDate(last.getUTCDate() + MAX_VISIT_DAYS);
  return { min: today, max: last.toISOString().slice(0, 10) };
}

/**
 * A person with their visit applied: `country` is where they watch from right now, `home_country` is
 * their own setting (for locales, settings and the daily check), and `visit` is set while they're away.
 * A union, so checking `country` also narrows `home_country`.
 */
export type Placed<T extends PlaceFields> = Omit<T, "country"> &
  ({ country: string; home_country: string; visit: Visit | null } | { country: null; home_country: null; visit: null });

export function withVisit<T extends PlaceFields>(person: T, now = new Date()): Placed<T> {
  const visit = activeVisit(person, now);
  return person.country
    ? { ...person, country: visit?.country ?? person.country, home_country: person.country, visit }
    : { ...person, country: null, home_country: null, visit: null };
}
