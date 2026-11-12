import "server-only";
import { cache } from "react";
import { appBadgeCount } from "./app-badge";
import { getMessages } from "./i18n";
import { titleNameFor } from "./nights";
import { sendPush } from "./push";
import { isSendAnswer, seasonReviewsFrom, type SeasonReviews, type SendAnswer } from "./shelf-rules";
import { createAdminClient } from "./supabase/admin";
import { createClient } from "./supabase/server";
import { pickText } from "./titles";
import { titleKey, type MediaType, type TitleRef } from "./watch";

// Queries for Sprint 21. Everything runs as the signed-in user (RLS limits it to their couple, and hides
// your partner's season reviews until you've written yours), except pushSend(), which needs the partner's
// push subscriptions.

export type TitleSend = TitleRef & {
  id: string;
  from_profile: string;
  to_profile: string;
  note: string;
  answer: SendAnswer | null;
  created_at: string;
};

type SendRow = {
  id: string;
  from_profile: string;
  to_profile: string;
  media_type: string;
  tmdb_id: number;
  note: string;
  answer: string | null;
  created_at: string;
};

const SEND_COLUMNS = "id, from_profile, to_profile, media_type, tmdb_id, note, answer, created_at";

function toSend(row: SendRow): TitleSend {
  return {
    id: row.id,
    from_profile: row.from_profile,
    to_profile: row.to_profile,
    media_type: row.media_type as MediaType,
    tmdb_id: row.tmdb_id,
    note: row.note,
    answer: isSendAnswer(row.answer) ? row.answer : null,
    created_at: row.created_at,
  };
}

export type WaitingSend = TitleSend & { title: string; poster_path: string | null; release_date: string | null };

/** Titles your partner has sent you that you haven't answered, newest first, named in the first cached locale. */
export async function getWaitingSends(coupleId: string, myId: string, locales: string[]): Promise<WaitingSend[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("title_sends")
    .select(`${SEND_COLUMNS}, titles(original_title, poster_path, release_date, title_texts(locale, title, poster_path))`)
    .eq("couple_id", coupleId)
    .eq("to_profile", myId)
    .is("answer", null)
    .in("titles.title_texts.locale", locales)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data.map((row) => ({
    ...toSend(row),
    ...pickText(row.titles.title_texts, locales, row.titles),
    release_date: row.titles.release_date,
  }));
}

/**
 * The latest send of this title each way, for the title page: what your partner sent you (waiting or
 * answered) and what you sent them.
 */
export const getTitleSends = cache(async (coupleId: string, myId: string, mediaType: MediaType, tmdbId: number) => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("title_sends")
    .select(SEND_COLUMNS)
    .eq("couple_id", coupleId)
    .eq("media_type", mediaType)
    .eq("tmdb_id", tmdbId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  const sends = data.map(toSend);
  return {
    toMe: sends.find((s) => s.to_profile === myId) ?? null,
    fromMe: sends.find((s) => s.from_profile === myId) ?? null,
  };
});

/** Your sends still waiting for an answer, by titleKey(), so search can say "Sent" (and take one back). */
export async function getOpenSends(coupleId: string, myId: string): Promise<Map<string, { id: string }>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("title_sends")
    .select("id, media_type, tmdb_id")
    .eq("couple_id", coupleId)
    .eq("from_profile", myId)
    .is("answer", null);
  if (error) throw error;
  return new Map(data.map((row) => [titleKey(row as TitleRef), { id: row.id }]));
}

/** One list item's season reviews: yours, and what you may see of your partner's. */
export async function getSeasonReviews(listItemId: string, myId: string): Promise<SeasonReviews> {
  const supabase = await createClient();
  const [rows, signals] = await Promise.all([
    supabase.from("season_reviews").select("season, profile_id, body").eq("list_item_id", listItemId),
    supabase.from("season_review_signals").select("season, profile_id").eq("list_item_id", listItemId),
  ]);
  if (rows.error) throw rows.error;
  if (signals.error) throw signals.error;
  return seasonReviewsFrom(rows.data, signals.data, myId);
}

/**
 * Tells your partner, on every device they've turned notifications on for, that you've sent them a title:
 * its name in their language and your note, with the app icon's count (which the send adds to). Never throws.
 */
export async function pushSend(
  send: TitleRef & { id: string; note: string },
  by: { id: string; couple_id: string; display_name: string },
  contact: string,
) {
  const admin = createAdminClient();
  if (!admin) return;
  try {
    const { data: partner, error } = await admin
      .from("profiles")
      .select("id, language, country, couple_id, alerts_seen_at, push_subscriptions(id, endpoint, p256dh, auth)")
      .eq("couple_id", by.couple_id)
      .neq("id", by.id)
      .maybeSingle();
    if (error) throw error;
    if (!partner || partner.push_subscriptions.length === 0) return;
    const t = getMessages(partner.language);
    const name = (await titleNameFor(admin, send, partner)) ?? "";
    await sendPush(
      admin,
      partner.push_subscriptions,
      {
        title: t.shelf.send.pushTitle(by.display_name || t.common.yourPartner),
        body: t.shelf.send.pushBody(name, send.note),
        url: `/title/${send.media_type}/${send.tmdb_id}`,
        tag: `send-${send.id}`,
        badge: await appBadgeCount(admin, partner),
      },
      contact,
    );
  } catch (error) {
    console.error(`Telling the partner about send ${send.id} failed`, error);
  }
}
