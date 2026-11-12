import "server-only";
import { getMessages } from "./i18n";
import { formatDay, formatTime } from "./night-rules";
import { titleNameFor } from "./nights";
import { dueReminder, formatCountdown, REMINDER_HORIZON_MS, type ReminderKind } from "./planning-rules";
import { sendPush, type PushMessage } from "./push";
import { createAdminClient } from "./supabase/admin";
import { isMediaType } from "./watch";

// Runs every 15 minutes (pg_cron calls /api/cron/night-reminders) with the secret key, across every couple.

type Person = {
  id: string;
  couple_id: string | null;
  display_name: string;
  language: string;
  country: string | null;
  time_zone: string;
  push_subscriptions: { id: string; endpoint: string; p256dh: string; auth: string }[];
};

export type ReminderReport = {
  /** Upcoming nights within a day of starting. */
  checked: number;
  sent: {
    night: string;
    kind: ReminderKind;
    to: { profile: string; devices: number; message: PushMessage }[];
  }[];
};

/**
 * One person's reminder: the countdown, the title, both of your times on your own clocks (you first, in
 * your language) and the night's note.
 */
function reminderMessage(
  night: { id: string; starts_at: string; notes: string },
  title: string | null,
  to: Person,
  partner: Person | undefined,
  now: Date,
): PushMessage {
  const all = getMessages(to.language);
  const t = all.nights;
  const start = new Date(night.starts_at);
  const at = (zone: string) => `${formatDay(start, zone, to.language)}, ${formatTime(start, zone, to.language)}`;
  const times = [
    t.timeFor(all.common.you, at(to.time_zone)),
    ...(partner ? [t.timeFor(partner.display_name || all.common.yourPartner, at(partner.time_zone))] : []),
  ].join(" · ");
  return {
    title: t.push.reminder.heading(formatCountdown(start, now, to.language)),
    body: [title ?? t.push.noTitle, times, night.notes && t.push.reminder.note(night.notes)].filter(Boolean).join("\n"),
    url: "/watch-nights",
    tag: `night-${night.id}`,
  };
}

/**
 * Sends the reminders that are due (see dueReminder()) to both people of each night, each in their own
 * language and time zone. Each kind is claimed in night_reminders before it's sent, so two runs never send
 * the same one; moving a night clears its rows (a trigger), which re-arms them. People without notifications
 * turned on are skipped, but the reminder still counts as sent. `contact` is the app's own URL, given to push
 * services.
 */
export async function runNightReminders(contact: string, now = new Date()): Promise<ReminderReport> {
  const admin = createAdminClient();
  if (!admin) throw new Error("SUPABASE_SECRET_KEY is not set");

  const { data: nights, error } = await admin
    .from("watch_nights")
    .select("id, couple_id, starts_at, notes, media_type, tmdb_id, night_reminders(kind)")
    .gt("starts_at", now.toISOString())
    .lte("starts_at", new Date(now.getTime() + REMINDER_HORIZON_MS).toISOString());
  if (error) throw error;

  const due = nights.flatMap((night) => {
    const kind = dueReminder(
      new Date(night.starts_at),
      now,
      night.night_reminders.map((r) => r.kind),
    );
    return kind ? [{ night, kind }] : [];
  });
  if (due.length === 0) return { checked: nights.length, sent: [] };

  // Claim them first: a row that's already there (another run got it) isn't returned.
  const { data: claimed, error: claimError } = await admin
    .from("night_reminders")
    .upsert(
      due.map(({ night, kind }) => ({ watch_night_id: night.id, kind, starts_at: night.starts_at })),
      { onConflict: "watch_night_id,kind", ignoreDuplicates: true },
    )
    .select("watch_night_id, kind");
  if (claimError) throw claimError;
  const ours = due.filter(({ night, kind }) => claimed.some((c) => c.watch_night_id === night.id && c.kind === kind));
  if (ours.length === 0) return { checked: nights.length, sent: [] };

  const { data: people, error: peopleError } = await admin
    .from("profiles")
    .select("id, couple_id, display_name, language, country, time_zone, push_subscriptions(id, endpoint, p256dh, auth)")
    .in("couple_id", [...new Set(ours.map(({ night }) => night.couple_id))]);
  if (peopleError) throw peopleError;

  const report: ReminderReport = { checked: nights.length, sent: [] };
  for (const { night, kind } of ours) {
    const members: Person[] = people.filter((p) => p.couple_id === night.couple_id);
    const ref = isMediaType(night.media_type) && night.tmdb_id ? { media_type: night.media_type, tmdb_id: night.tmdb_id } : null;
    const to = await Promise.all(
      members.map(async (person) => {
        const title = ref && (await titleNameFor(admin, ref, person));
        const message = reminderMessage(night, title, person, members.find((p) => p.id !== person.id), now);
        const devices = await sendPush(admin, person.push_subscriptions, message, contact);
        return { profile: person.id, devices, message };
      }),
    );
    report.sent.push({ night: night.id, kind, to });
  }
  return report;
}
