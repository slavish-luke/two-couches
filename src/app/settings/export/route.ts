import { getRewatches, getSeasonRatings } from "@/lib/diary";
import type { SeasonRatings } from "@/lib/diary-rules";
import { exportCsv, exportFileName, exportJson, isCsvKind, type ExportData } from "@/lib/export-rules";
import { getMessages } from "@/lib/i18n";
import { getList } from "@/lib/list";
import { localDate } from "@/lib/list-rules";
import { getCurrentProfile, getPartner } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { pickText } from "@/lib/titles";
import { tmdbLocale } from "@/lib/tmdb";

/**
 * "Your data": everything the couple keeps here, as one JSON file (`?format=json`) or a CSV per kind
 * (`?format=csv&kind=list|watches|seasons|nights|reviews`). Runs as the signed-in user, so RLS decides what's
 * in it: your partner's reviews only where you can already read them.
 */
export async function GET(request: Request) {
  const [profile, partner] = await Promise.all([getCurrentProfile(), getPartner()]);
  if (!profile?.couple_id || !profile.home_country) return new Response(null, { status: 401 });

  const params = new URL(request.url).searchParams;
  const format = params.get("format");
  const kind = params.get("kind");
  if (format !== "json" && !(format === "csv" && isCsvKind(kind))) return new Response(null, { status: 400 });

  const t = getMessages(profile.language);
  const locale = tmdbLocale(profile.language, profile.home_country);
  const locales = partner?.home_country ? [locale, tmdbLocale(partner.language, partner.home_country)] : [locale];
  const coupleId = profile.couple_id;
  const supabase = await createClient();

  const [entries, rewatches, seasonRows, nights, reviews] = await Promise.all([
    getList(coupleId, locales),
    getRewatches(coupleId),
    getSeasonRatings(coupleId),
    supabase
      .from("watch_nights")
      .select("starts_at, media_type, tmdb_id, method, link, syncplay_server, syncplay_room, notes, created_by, titles(original_title, poster_path, title_texts(locale, title, poster_path))")
      .eq("couple_id", coupleId)
      .in("titles.title_texts.locale", locales)
      .order("starts_at"),
    supabase.from("list_reviews").select("list_item_id, profile_id, body, updated_at").eq("couple_id", coupleId).order("updated_at"),
  ]);
  if (nights.error || reviews.error) {
    console.error("Exporting failed", nights.error ?? reviews.error);
    return new Response(null, { status: 500 });
  }

  const seasons: Record<string, SeasonRatings> = {};
  for (const row of seasonRows) ((seasons[row.list_item_id] ??= {})[row.season] ??= {})[row.profile_id] = row.rating;

  const data: ExportData = {
    people: [
      { id: profile.id, name: profile.display_name || t.common.you, me: true },
      ...(partner ? [{ id: partner.id, name: partner.display_name || t.common.yourPartner, me: false }] : []),
    ],
    items: entries
      .toSorted((a, b) => a.created_at.localeCompare(b.created_at))
      .map((e) => ({
        id: e.id,
        media_type: e.media_type,
        tmdb_id: e.tmdb_id,
        title: e.title,
        year: e.release_date?.slice(0, 4) ?? null,
        status: e.status,
        categories: e.categories,
        notes: e.notes,
        season: e.season,
        episode: e.episode,
        watched_on: e.watched_on,
        added_by: e.added_by,
        created_at: e.created_at,
        ratings: e.ratings,
      })),
    rewatches,
    seasons,
    nights: nights.data.map((n) => ({
      starts_at: n.starts_at,
      media_type: n.media_type,
      tmdb_id: n.tmdb_id,
      title: n.titles ? pickText(n.titles.title_texts, locales, n.titles).title : null,
      method: n.method,
      link: n.link,
      syncplay_server: n.syncplay_server,
      syncplay_room: n.syncplay_room,
      notes: n.notes,
      created_by: n.created_by,
    })),
    reviews: reviews.data,
  };

  const now = new Date();
  const today = localDate(profile.time_zone, now);
  const headings = { ...t.diary.export.columns, types: t.common.mediaType, statuses: t.common.statuses };
  const [body, type, name] = format === "csv" && isCsvKind(kind)
    ? [exportCsv(kind, data, headings), "text/csv", exportFileName(kind, today, "csv")]
    : [JSON.stringify(exportJson(data, now), null, 2), "application/json", exportFileName("everything", today, "json")];

  return new Response(body, {
    headers: {
      "Content-Type": `${type}; charset=utf-8`,
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
