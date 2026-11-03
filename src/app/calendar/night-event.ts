import type { Messages } from "@/lib/i18n";
import { DEFAULT_LENGTH_MIN, formatDay, formatTime, type IcsEvent, type NightMethod } from "@/lib/night-rules";

/** What a calendar event needs to know about a watch night. */
export type EventNight = {
  id: string;
  starts_at: string;
  updated_at?: string;
  method: NightMethod | null;
  link: string | null;
  syncplay_server: string | null;
  syncplay_room: string | null;
  notes: string;
  title: { title: string; media_type: string; runtime: number | null } | null;
};

/** Someone whose local start time goes in the description: the calendar's owner first, as "You". */
export type EventPerson = { name: string; timeZone: string };

/**
 * A watch night as a calendar event, in one person's language: what you're watching, when it starts on
 * each of your clocks, how you'll watch and the note. Pure, for the single-night file and the feed.
 */
export function nightEvent(
  night: EventNight,
  { t, language, people, origin }: { t: Messages; language: string; people: EventPerson[]; origin: string },
): IcsEvent {
  const start = new Date(night.starts_at);
  const when = (zone: string) => `${formatDay(start, zone, language)}, ${formatTime(start, zone, language)}`;
  const how = night.method
    ? [
        t.nights.methods[night.method],
        night.link,
        night.syncplay_server && t.nights.syncplayServer(night.syncplay_server),
        night.syncplay_room && t.nights.syncplayRoom(night.syncplay_room),
      ]
        .filter(Boolean)
        .join(" · ")
    : t.nights.undecided;
  return {
    // Stable per night, so a moved or retitled night replaces its event.
    uid: `${night.id}@two-couches`,
    start,
    // A series' runtime is one episode, which says little about the night.
    minutes: (night.title?.media_type === "movie" && night.title.runtime) || DEFAULT_LENGTH_MIN,
    summary: t.nights.ics.summary(night.title?.title ?? t.nights.noTitle),
    description: [people.map((p) => t.nights.timeFor(p.name, when(p.timeZone))).join("\n"), how, night.notes]
      .filter(Boolean)
      .join("\n\n"),
    url: `${origin}/watch-nights`,
    updated: night.updated_at ? new Date(night.updated_at) : undefined,
  };
}
