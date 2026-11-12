/** When the daily check sends an alert, and how it reads. Pure functions, safe in server and client code. */
import type { Messages } from "./i18n";
import type { ListStatus } from "./list-rules";
import { freeFor, streamableFor, type Availability, type Provider, type Watcher } from "./watch";

/** List titles the daily check watches. Watched and dropped ones are done with. */
export const ALERT_STATUSES: ListStatus[] = ["want", "watching"];

/**
 * "both": each of you can now stream it. "one": one of you can (or you can, before pairing up).
 * "free": it became free (or free with ads) where one of you lives. "gone": it left a service one of you
 * pays for, and that person can't stream it any more.
 */
export type AlertKind = "both" | "one" | "free" | "gone";

export function isAlertKind(value: unknown): value is AlertKind {
  return value === "both" || value === "one" || value === "free" || value === "gone";
}

/**
 * What an alert is about for one person: their country then, the providers it's about and, for "free",
 * whether every one of them shows ads.
 */
export type AlertDetail = { country: string; providers: { id: number; name: string }[]; ads?: boolean };

/** An alert's details column: AlertDetail by profile ID. */
export type AlertDetails = Record<string, AlertDetail>;

/** One piece of news about one title for one couple. */
export type AlertNews = { kind: AlertKind; details: AlertDetails };

type Member = Watcher & { id: string };

/** How many of the couple can stream a title on a subscription they pay for, in their own country. */
export function watchLevel(members: Watcher[], availability: Availability) {
  return members.filter((m) => streamableFor(m, availability).length > 0).length;
}

/** Can watch it without paying anything more: on a service they pay for, or free (with or without ads). */
function canWatch(member: Watcher, availability: Availability) {
  return streamableFor(member, availability).length > 0 || freeFor(member, availability).length > 0;
}

/**
 * Whether a title newly streams for the couple, given what the last check saw (`before`) and what's there
 * now. Both are judged by the services the couple pays for today, so changing settings never sends an
 * alert. List titles alert only when they become watchable for both of you; reminders also when one of you
 * first can.
 */
export function alertFor(
  members: Watcher[],
  before: Availability,
  now: Availability,
  { listed, reminded }: { listed: boolean; reminded: boolean },
): "both" | "one" | null {
  const was = watchLevel(members, before);
  const is = watchLevel(members, now);
  if (is <= was) return null;
  if (members.length === 2 && is === 2) return listed || reminded ? "both" : null;
  return reminded ? "one" : null;
}

function detailOf(member: Member, providers: Provider[], extra: Partial<AlertDetail> = {}): [string, AlertDetail] {
  return [member.id, { country: member.country, providers: providers.map((p) => ({ id: p.provider_id, name: p.name })), ...extra }];
}

/**
 * Everything to tell a couple about one title (at most one good piece of news and one bad):
 *   * it newly streams for you (alertFor(): "both" or "one");
 *   * otherwise, if it's on the list or has a reminder, "free" when it became free or free with ads in the
 *     country of someone who can't stream it on a subscription;
 *   * for list titles, "gone" when someone who could stream it on a service they pay for no longer can
 *     (and can't watch it free either).
 * Like alertFor(), judged by today's services, so changing settings never alerts.
 */
export function alertsFor(
  members: Member[],
  before: Availability,
  now: Availability,
  flags: { listed: boolean; reminded: boolean },
): AlertNews[] {
  const news: AlertNews[] = [];
  const arrival = alertFor(members, before, now, flags);
  if (arrival) {
    const streaming = members.filter((m) => streamableFor(m, now).length > 0);
    news.push({ kind: arrival, details: Object.fromEntries(streaming.map((m) => detailOf(m, streamableFor(m, now)))) });
  } else if (flags.listed || flags.reminded) {
    const freed = members.filter(
      (m) => streamableFor(m, now).length === 0 && freeFor(m, now).length > 0 && freeFor(m, before).length === 0,
    );
    if (freed.length > 0) {
      news.push({
        kind: "free",
        details: Object.fromEntries(
          freed.map((m) => detailOf(m, freeFor(m, now), { ads: freeFor(m, now).every((p) => p.kind === "ads") })),
        ),
      });
    }
  }
  if (flags.listed) {
    const lost = members.filter((m) => streamableFor(m, before).length > 0 && !canWatch(m, now));
    if (lost.length > 0) {
      news.push({ kind: "gone", details: Object.fromEntries(lost.map((m) => detailOf(m, streamableFor(m, before)))) });
    }
  }
  return news;
}

/** A reminder has done its job once everyone in the couple can stream the title or watch it free. */
export function reminderDone(members: Watcher[], now: Availability) {
  return members.length > 0 && members.every((m) => canWatch(m, now));
}

/**
 * The services a "gone" alert said a person lost, that are still gone: they still pay for them, the title
 * isn't back on them, and they can't stream it (or watch it free) anywhere else. Empty when there's nothing
 * to flag, including when they're watching from another country today or it couldn't be checked.
 */
export function stillGone(detail: AlertDetail | undefined, person: Watcher, now: Availability) {
  const there = now[person.country];
  if (!detail || !there || detail.country !== person.country || canWatch(person, now)) return [];
  const back = new Set(there.providers.filter((p) => p.kind === "flatrate").map((p) => p.provider_id));
  return detail.providers.filter((p) => person.services.includes(p.id) && !back.has(p.id));
}

/** An alert's details column, read defensively: anything malformed is left out. */
export function readAlertDetails(value: unknown): AlertDetails {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const details: AlertDetails = {};
  for (const [id, raw] of Object.entries(value as Record<string, unknown>)) {
    if (!raw || typeof raw !== "object") continue;
    const { country, providers, ads } = raw as Record<string, unknown>;
    if (typeof country !== "string" || !Array.isArray(providers)) continue;
    details[id] = {
      country,
      providers: providers.filter((p: unknown): p is { id: number; name: string } => {
        const { id, name } = (p ?? {}) as Record<string, unknown>;
        return typeof id === "number" && typeof name === "string";
      }),
      ...(typeof ads === "boolean" && { ads }),
    };
  }
  return details;
}

/**
 * An alert as one person reads it: a heading ("Now streaming for both of you") and where each of you can
 * stream it ("You: Netflix · Sam: Max"), or for "gone" what each of you lost ("You: left Netflix in GB").
 * `services` is the alert's provider names by profile ID; `details` (newer alerts) adds the countries and
 * whether a free service has ads.
 */
export function describeAlert(
  alert: { kind: AlertKind; services: Record<string, string[]>; details?: AlertDetails | null },
  viewerId: string,
  partner: { id: string; name: string } | null,
  t: Messages["upcoming"]["alerts"],
) {
  const mine = alert.services[viewerId] ?? [];
  const theirs = partner ? (alert.services[partner.id] ?? []) : [];
  const who = (forBoth: string, forMe: string, forPartner: (name: string) => string) =>
    mine.length > 0 && theirs.length > 0 ? forBoth : mine.length > 0 || !partner ? forMe : forPartner(partner.name);

  let heading: string;
  if (alert.kind === "gone") heading = who(t.gone.both, t.gone.me, t.gone.partner);
  else if (alert.kind === "free") {
    const named = [viewerId, partner?.id].filter((id): id is string => Boolean(id && alert.services[id]?.length));
    const ads = named.length > 0 && named.every((id) => alert.details?.[id]?.ads);
    const text = ads ? t.freeAds : t.free;
    heading = who(text.both, text.me, text.partner);
  } else heading = alert.kind === "both" ? t.both : mine.length > 0 || !partner ? t.me : t.partner(partner.name);

  const line = (id: string, name: string, services: string[]) => {
    const country = alert.details?.[id]?.country;
    return alert.kind === "gone" && country
      ? t.left(name, services.join(", "), country)
      : t.services(name, services.join(", "));
  };
  const detail = [
    mine.length > 0 ? line(viewerId, t.you, mine) : null,
    partner && theirs.length > 0 ? line(partner.id, partner.name, theirs) : null,
  ]
    .filter(Boolean)
    .join(" · ");
  return { heading, detail };
}
