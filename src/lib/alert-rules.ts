/** When the daily check sends an alert, and how it reads. Pure functions, safe in server and client code. */
import type { Messages } from "./i18n";
import type { ListStatus } from "./list-rules";
import { streamableFor, type Availability, type Watcher } from "./watch";

/** List titles the daily check watches. Watched and dropped ones are done with. */
export const ALERT_STATUSES: ListStatus[] = ["want", "watching"];

/** "both": each of you can now stream it. "one": one of you can (or you can, before pairing up). */
export type AlertKind = "both" | "one";

export function isAlertKind(value: unknown): value is AlertKind {
  return value === "both" || value === "one";
}

/** How many of the couple can stream a title on a subscription they pay for, in their own country. */
export function watchLevel(members: Watcher[], availability: Availability) {
  return members.filter((m) => streamableFor(m, availability).length > 0).length;
}

/**
 * What to tell a couple about one title, given what the last check saw (`before`) and what's there now.
 * Both are judged by the services the couple pays for today, so changing settings never sends an alert.
 * List titles alert only when they become watchable for both of you; reminders also when one of you
 * first can.
 */
export function alertFor(
  members: Watcher[],
  before: Availability,
  now: Availability,
  { listed, reminded }: { listed: boolean; reminded: boolean },
): AlertKind | null {
  const was = watchLevel(members, before);
  const is = watchLevel(members, now);
  if (is <= was) return null;
  if (members.length === 2 && is === 2) return listed || reminded ? "both" : null;
  return reminded ? "one" : null;
}

/** A reminder has done its job once everyone in the couple can stream the title. */
export function reminderDone(members: Watcher[], now: Availability) {
  return members.length > 0 && watchLevel(members, now) === members.length;
}

/**
 * An alert as one person reads it: a heading ("Now streaming for both of you") and where each of you can
 * stream it ("You: Netflix · Sam: Max"). `services` is the alert's provider names by profile ID.
 */
export function describeAlert(
  alert: { kind: AlertKind; services: Record<string, string[]> },
  viewerId: string,
  partner: { id: string; name: string } | null,
  t: Messages["upcoming"]["alerts"],
) {
  const mine = alert.services[viewerId] ?? [];
  const theirs = partner ? (alert.services[partner.id] ?? []) : [];
  const heading =
    alert.kind === "both" ? t.both : mine.length > 0 || !partner ? t.me : t.partner(partner.name);
  const detail = [
    mine.length > 0 ? t.services(t.you, mine.join(", ")) : null,
    partner && theirs.length > 0 ? t.services(partner.name, theirs.join(", ")) : null,
  ]
    .filter(Boolean)
    .join(" · ");
  return { heading, detail };
}
