import { FEED_REFRESH_MINUTES } from "@/lib/night-rules";
import { feedCalendar } from "../feed";
import { isFeedToken } from "../token";

/**
 * A private calendar feed of the couple's watch nights, at /calendar/<token>.ics. Calendar apps fetch it
 * without a session (see PUBLIC_PATHS in src/proxy.ts); the token is the key. Unknown tokens get a 404.
 */
export async function GET(request: Request, { params }: RouteContext<"/calendar/[feed]">) {
  const { feed } = await params;
  const token = feed.endsWith(".ics") ? feed.slice(0, -4) : "";
  if (!isFeedToken(token)) return new Response(null, { status: 404 });

  const body = await feedCalendar(token, new URL(request.url).origin);
  if (body === null) return new Response(null, { status: 404, headers: { "Cache-Control": "no-store" } });

  return new Response(body, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="watch-nights.ics"',
      // Private: the URL is a secret, so no shared cache should keep a copy.
      "Cache-Control": `private, max-age=${FEED_REFRESH_MINUTES * 60}`,
      "X-Robots-Tag": "noindex",
    },
  });
}
