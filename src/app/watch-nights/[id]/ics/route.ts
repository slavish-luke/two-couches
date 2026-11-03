import { nightEvent } from "@/app/calendar/night-event";
import { getMessages } from "@/lib/i18n";
import { toIcs } from "@/lib/night-rules";
import { getWatchNight } from "@/lib/nights";
import { getCurrentProfile, getPartner } from "@/lib/session";
import { tmdbLocale } from "@/lib/tmdb";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A watch night as an iCalendar file, in the viewer's language, to add to their own calendar app. */
export async function GET(request: Request, { params }: RouteContext<"/watch-nights/[id]/ics">) {
  const [{ id }, profile, partner] = await Promise.all([params, getCurrentProfile(), getPartner()]);
  if (!profile?.country) return new Response(null, { status: 401 });
  if (!UUID.test(id)) return new Response(null, { status: 404 });

  const locale = tmdbLocale(profile.language, profile.home_country);
  const locales = partner?.country ? [locale, tmdbLocale(partner.language, partner.home_country)] : [locale];
  const night = await getWatchNight(id, locales);
  if (!night) return new Response(null, { status: 404 });

  const t = getMessages(profile.language);
  const people = [{ name: t.common.you, timeZone: profile.time_zone }];
  if (partner) people.push({ name: partner.display_name || t.common.yourPartner, timeZone: partner.time_zone });
  const event = nightEvent(night, { t, language: profile.language, people, origin: new URL(request.url).origin });
  return new Response(toIcs([event]), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="watch-night.ics"',
      "Cache-Control": "private, no-store",
    },
  });
}
