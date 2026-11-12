import "server-only";
import { ALERT_STATUSES, alertsFor, describeAlert, isAlertKind, readAlertDetails, reminderDone } from "./alert-rules";
import { alertServices, flatrateIds, freeIds } from "./alerts";
import { appBadgeCount } from "./app-badge";
import { getMessages } from "./i18n";
import { isPushConfigured, sendPush, type PushMessage } from "./push";
import { createAdminClient } from "./supabase/admin";
import type { Database, Json } from "./supabase/database.types";
import { getAvailability } from "./titles";
import { tmdbLocale } from "./tmdb";
import { freeFor, titleHref, titleKey, type Availability, type Provider, type TitleRef, type Watcher } from "./watch";

// Runs once a day (pg_cron calls /api/cron/daily) with the secret key, across every couple.

/** A check of a title's providers this recent is reused rather than asked of TMDB again. */
const MAX_AGE_MS = 6 * 60 * 60 * 1000;
/** How long alerts are kept. */
const KEEP_ALERTS_MS = 90 * 24 * 60 * 60 * 1000;
/** More new alerts than this for one person become a single summary notification. */
const MAX_NOTIFICATIONS = 3;

type Admin = NonNullable<ReturnType<typeof createAdminClient>>;
type AlertRow = Database["public"]["Tables"]["alerts"]["Row"];
type SnapshotRow = Database["public"]["Tables"]["availability_snapshots"]["Row"];
type Member = Watcher & { id: string; name: string | null; language: string; couple_id: string; alerts_seen_at: string };
/** A title a couple is waiting for: on their list, with a reminder, or both. */
type Watched = { ref: TitleRef; listed: boolean; reminderId: string | null };

/** A notification as it was (or, with no devices, would have been) sent. For checking the job by hand. */
export type SentMessage = PushMessage & { profileId: string; devices: number };

export type DailyCheckResult = {
  titles: number;
  alerts: number;
  notifications: number;
  remindersDone: number;
  messages: SentMessage[];
};

function keyOf(row: { media_type: string; tmdb_id: number }): TitleRef {
  return { media_type: row.media_type as TitleRef["media_type"], tmdb_id: row.tmdb_id };
}

/**
 * Re-checks where every watched title streams, records an alert for each couple whose title has newly
 * arrived, turned free or gone (see alertsFor()), retires reminders that are done and sends push
 * notifications. `contact` is the app's own URL, given to push services.
 */
export async function runDailyCheck(contact: string): Promise<DailyCheckResult> {
  const admin = createAdminClient();
  if (!admin) throw new Error("SUPABASE_SECRET_KEY is not set");

  const [items, reminders, snapshotRows] = await Promise.all([
    admin.from("list_items").select("couple_id, media_type, tmdb_id").in("status", ALERT_STATUSES),
    admin.from("reminders").select("id, couple_id, media_type, tmdb_id"),
    admin.from("availability_snapshots").select("*"),
  ]);
  if (items.error) throw items.error;
  if (reminders.error) throw reminders.error;
  if (snapshotRows.error) throw snapshotRows.error;

  // What each couple is waiting for, by couple and then titleKey().
  const watching = new Map<string, Map<string, Watched>>();
  const watch = (coupleId: string, ref: TitleRef, change: Partial<Watched>) => {
    const titles = watching.get(coupleId) ?? new Map<string, Watched>();
    watching.set(coupleId, titles);
    const key = titleKey(ref);
    titles.set(key, { ref, listed: false, reminderId: null, ...titles.get(key), ...change });
  };
  for (const row of items.data) watch(row.couple_id, keyOf(row), { listed: true });
  for (const row of reminders.data) watch(row.couple_id, keyOf(row), { reminderId: row.id });

  const { data: profiles, error } = await admin
    .from("profiles")
    .select("id, display_name, country, language, services, couple_id, alerts_seen_at")
    .in("couple_id", [...watching.keys()])
    .order("created_at");
  if (error) throw error;
  // Someone who hasn't picked a country can't stream anything yet, so only the others count.
  const members = new Map<string, Member[]>();
  for (const p of profiles) {
    if (!p.couple_id || !p.country) continue;
    const couple = members.get(p.couple_id) ?? [];
    couple.push({
      id: p.id,
      name: p.display_name || null,
      language: p.language,
      country: p.country,
      services: p.services,
      couple_id: p.couple_id,
      alerts_seen_at: p.alerts_seen_at,
    });
    members.set(p.couple_id, couple);
  }

  const refs = [...new Map([...watching.values()].flatMap((titles) => [...titles])).values()].map((w) => w.ref);
  const countries = [...new Set([...members.values()].flat().map((m) => m.country))];
  const [availability, services] = await Promise.all([
    getAvailability(refs, countries, { client: admin, maxAgeMs: MAX_AGE_MS }),
    admin.from("services").select("country, provider_id, name").in("country", countries),
  ]);
  if (services.error) console.error("Loading service names for the daily check failed", services.error);
  // A provider's name, for one that has gone (snapshots keep only IDs): from the country's service list.
  const serviceNames = new Map((services.data ?? []).map((s) => [`${s.country}:${s.provider_id}`, s.name]));

  // What the last check saw, by titleKey() and country.
  const snapshots: Record<string, Record<string, SnapshotRow>> = {};
  for (const row of snapshotRows.data) (snapshots[titleKey(keyOf(row))] ??= {})[row.country] = row;

  /**
   * A snapshot in availability's shape: its subscription providers, and its free ones. Rows from before free
   * providers were kept (`free_ids` null) take today's free providers, so they don't all count as new.
   */
  const snapshotAvailability = (rows: Record<string, SnapshotRow>, now: Availability): Availability => {
    const provider = (country: string, id: number, kind: Provider["kind"]): Provider => ({
      provider_id: id,
      name: serviceNames.get(`${country}:${id}`) ?? "",
      logo_path: null,
      kind,
      display_priority: 0,
    });
    return Object.fromEntries(
      Object.entries(rows).map(([country, row]) => [
        country,
        {
          providers: [
            ...row.provider_ids.map((id) => provider(country, id, "flatrate")),
            ...(row.free_ids
              ? row.free_ids.map((id) => provider(country, id, "free"))
              : freeFor({ country }, now)),
          ],
          link: null,
          checked_at: row.recorded_at,
        },
      ]),
    );
  };

  const newAlerts: Database["public"]["Tables"]["alerts"]["Insert"][] = [];
  const done: string[] = [];
  for (const [coupleId, titles] of watching) {
    const couple = members.get(coupleId) ?? [];
    if (couple.length === 0) continue;
    for (const [key, watched] of titles) {
      const now = availability[key] ?? {};
      // TMDB couldn't be asked about one of the countries; try again tomorrow.
      if (couple.some((m) => !now[m.country])) continue;
      // Nothing to compare with yet (or someone has moved country): today becomes the baseline.
      const last = snapshots[key];
      const before = last && couple.every((m) => last[m.country]) ? snapshotAvailability(last, now) : now;
      const news = alertsFor(couple, before, now, { listed: watched.listed, reminded: watched.reminderId !== null });
      for (const { kind, details } of news) {
        newAlerts.push({
          couple_id: coupleId,
          ...watched.ref,
          kind,
          services: Object.fromEntries(
            Object.entries(details).map(([id, d]) => [id, d.providers.map((p) => p.name || `#${p.id}`)]),
          ),
          details: details as Json,
        });
      }
      if (watched.reminderId && reminderDone(couple, now)) done.push(watched.reminderId);
    }
  }

  // Alerts before snapshots: if saving them fails, tomorrow's check finds the same news again.
  let inserted: AlertRow[] = [];
  if (newAlerts.length > 0) {
    const { data, error } = await admin.from("alerts").insert(newAlerts).select("*");
    if (error) throw error;
    inserted = data;
  }

  const recordedAt = new Date().toISOString();
  const snapshotUpdates = refs.flatMap((ref) =>
    countries.flatMap((country) => {
      const there = availability[titleKey(ref)]?.[country];
      return there
        ? [{ ...ref, country, provider_ids: flatrateIds(there), free_ids: freeIds(there), recorded_at: recordedAt }]
        : [];
    }),
  );
  const watchedKeys = new Set(refs.map(titleKey));
  const forgotten = [
    ...new Map(
      snapshotRows.data.filter((row) => !watchedKeys.has(titleKey(keyOf(row)))).map((row) => [titleKey(keyOf(row)), keyOf(row)]),
    ).values(),
  ];
  const cutoff = new Date(Date.now() - KEEP_ALERTS_MS).toISOString();
  const tidying = await Promise.all([
    snapshotUpdates.length > 0 ? admin.from("availability_snapshots").upsert(snapshotUpdates) : { error: null },
    ...forgotten.map((ref) =>
      admin.from("availability_snapshots").delete().eq("media_type", ref.media_type).eq("tmdb_id", ref.tmdb_id),
    ),
    done.length > 0 ? admin.from("reminders").delete().in("id", done) : { error: null },
    admin.from("alerts").delete().lt("created_at", cutoff),
  ]);
  const tidyError = tidying.find((r) => r.error)?.error;
  if (tidyError) console.error("Saving the daily check's snapshots failed", tidyError);

  const messages = await notify(admin, inserted, members, contact);
  return {
    titles: refs.length,
    alerts: inserted.length,
    notifications: messages.reduce((sum, m) => sum + m.devices, 0),
    remindersDone: done.length,
    messages,
  };
}

/**
 * Push notifications for new alerts, to each member's devices, in their own language, with the app icon's
 * new count. Returns every message, including the ones for people with no devices (not sent).
 */
async function notify(admin: Admin, alerts: AlertRow[], members: Map<string, Member[]>, contact: string) {
  if (alerts.length === 0) return [];

  const people = [...new Set(alerts.map((a) => a.couple_id))].flatMap((id) => members.get(id) ?? []);
  const [subscriptions, titles] = await Promise.all([
    admin.from("push_subscriptions").select("id, profile_id, endpoint, p256dh, auth").in("profile_id", people.map((p) => p.id)),
    admin
      .from("titles")
      .select("media_type, tmdb_id, original_title, title_texts(locale, title)")
      .in("tmdb_id", [...new Set(alerts.map((a) => a.tmdb_id))]),
  ]);
  if (subscriptions.error) throw subscriptions.error;
  if (titles.error) throw titles.error;

  // The title's name in this person's locale, else their language, else its original title.
  const nameFor = (alert: AlertRow, person: Member) => {
    const title = titles.data.find((t) => t.media_type === alert.media_type && t.tmdb_id === alert.tmdb_id);
    if (!title) return "";
    const locale = tmdbLocale(person.language, person.country);
    const text =
      title.title_texts.find((t) => t.locale === locale) ??
      title.title_texts.find((t) => t.locale.startsWith(`${person.language}-`));
    return text?.title ?? title.original_title;
  };

  const sent: SentMessage[] = [];
  for (const [coupleId, couple] of members) {
    const theirs = alerts.filter((a) => a.couple_id === coupleId);
    for (const person of theirs.length > 0 ? couple : []) {
      const devices = subscriptions.data.filter((s) => s.profile_id === person.id);
      const t = getMessages(person.language);
      const other = couple.find((m) => m.id !== person.id);
      const partner = other ? { id: other.id, name: other.name ?? t.common.yourPartner } : null;
      const badge = await appBadgeCount(admin, person);
      const messages: PushMessage[] =
        theirs.length > MAX_NOTIFICATIONS
          ? [{ title: t.common.appName, body: t.upcoming.alerts.summary(theirs.length), url: "/coming-soon", tag: "alerts", badge }]
          : theirs.flatMap((alert) => {
              if (!isAlertKind(alert.kind)) return [];
              const { heading, detail } = describeAlert(
                { kind: alert.kind, services: alertServices(alert.services), details: readAlertDetails(alert.details) },
                person.id,
                partner,
                t.upcoming.alerts,
              );
              const body = detail ? `${heading}. ${detail}` : heading;
              return [{ title: nameFor(alert, person), body, url: titleHref(keyOf(alert)), tag: alert.id, badge }];
            });
      for (const message of messages) {
        const accepted = isPushConfigured() ? await sendPush(admin, devices, message, contact) : 0;
        sent.push({ ...message, profileId: person.id, devices: accepted });
      }
    }
  }
  return sent;
}
