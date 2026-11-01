import { getMessages } from "@/lib/i18n";
import { DEFAULT_LENGTH_MIN, toIcs } from "@/lib/night-rules";
import { getWatchNight } from "@/lib/nights";
import { getCurrentProfile, getPartner } from "@/lib/session";
import { tmdbLocale } from "@/lib/tmdb";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A watch night as an iCalendar file, in the viewer's language, to add to their own calendar app. */
export async function GET(request: Request, { params }: RouteContext<"/watch-nights/[id]/ics">) {
  const [{ id }, profile, partner] = await Promise.all([params, getCurrentProfile(), getPartner()]);
  if (!profile?.country) return new Response(null, { status: 401 });
  if (!UUID.test(id)) return new Response(null, { status: 404 });

  const locale = tmdbLocale(profile.language, profile.country);
  const locales = partner?.country ? [locale, tmdbLocale(partner.language, partner.country)] : [locale];
  const night = await getWatchNight(id, locales);
  if (!night) return new Response(null, { status: 404 });

  const t = getMessages(profile.language).nights;
  const how = night.method
    ? [
        t.methods[night.method],
        night.link,
        night.syncplay_server && t.syncplayServer(night.syncplay_server),
        night.syncplay_room && t.syncplayRoom(night.syncplay_room),
      ]
    : [];
  const origin = new URL(request.url).origin;
  const body = toIcs({
    uid: `${night.id}@two-couches`,
    start: new Date(night.starts_at),
    // A series' runtime is one episode, which says little about the night.
    minutes: (night.title?.media_type === "movie" && night.title.runtime) || DEFAULT_LENGTH_MIN,
    summary: t.ics.summary(night.title?.title ?? t.noTitle),
    description: [how.filter(Boolean).join(" · "), night.notes].filter(Boolean).join("\n\n"),
    url: `${origin}/watch-nights`,
  });
  return new Response(body, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="watch-night.ics"',
      "Cache-Control": "private, no-store",
    },
  });
}
