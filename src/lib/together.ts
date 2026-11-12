import "server-only";
import { getMessages, type Messages } from "./i18n";
import { sendPush, type PushMessage } from "./push";
import { createAdminClient } from "./supabase/admin";
import { createClient } from "./supabase/server";
import { tmdbGet } from "./tmdb";
import {
  asReaction,
  episodeKey,
  PHOTO_BUCKET,
  isNudgeKind,
  reveal,
  type NudgeKind,
  type Reaction,
  type Reveal,
} from "./together-rules";

// Queries for Sprint 20's little things. Everything runs as the signed-in user (RLS limits it to their
// couple, and hides your partner's answers and episode reactions until you've given yours), except
// pushToPartner(), which needs the partner's push subscriptions.

/**
 * Sends your partner a push on every device they've turned notifications on for, in their language.
 * `build` gets their messages and returns what to say. Never throws.
 */
export async function pushToPartner(
  by: { id: string; couple_id: string; display_name: string },
  build: (t: Messages, name: string) => PushMessage,
  contact: string,
) {
  const admin = createAdminClient();
  if (!admin) return;
  try {
    const { data: partner, error } = await admin
      .from("profiles")
      .select("id, language, push_subscriptions(id, endpoint, p256dh, auth)")
      .eq("couple_id", by.couple_id)
      .neq("id", by.id)
      .maybeSingle();
    if (error) throw error;
    if (!partner || partner.push_subscriptions.length === 0) return;
    const t = getMessages(partner.language);
    await sendPush(admin, partner.push_subscriptions, build(t, by.display_name || t.common.yourPartner), contact);
  } catch (error) {
    console.error("Pushing to the partner failed", error);
  }
}

// ---------------------------------------------------------------------------
// Nudges
// ---------------------------------------------------------------------------

export type Nudge = { id: string; kind: NudgeKind; sent_at: string };

/** The latest nudge sent to you that you haven't marked seen, and when you last sent one. */
export async function getNudges(coupleId: string, myId: string) {
  const supabase = await createClient();
  const [incoming, outgoing] = await Promise.all([
    supabase
      .from("nudges")
      .select("id, kind, sent_at")
      .eq("couple_id", coupleId)
      .eq("to_profile", myId)
      .is("seen_at", null)
      .order("sent_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("nudges")
      .select("sent_at")
      .eq("couple_id", coupleId)
      .eq("from_profile", myId)
      .order("sent_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  if (incoming.error) console.error("Loading nudges failed", incoming.error);
  const row = incoming.data;
  return {
    incoming: row && isNudgeKind(row.kind) ? ({ id: row.id, kind: row.kind, sent_at: row.sent_at } satisfies Nudge) : null,
    lastSentAt: outgoing.data?.sent_at ?? null,
  };
}

// ---------------------------------------------------------------------------
// Tonight's question
// ---------------------------------------------------------------------------

export type QuestionDay = {
  day: string;
  question: number;
  mine: { body: string; updated_at: string } | null;
  partner: Reveal<string>;
};

/**
 * Each day's answers between `from` and `to` (inclusive), newest first, for the days either of you
 * answered. Your partner's text is there only when you've answered that day too (RLS); their signal says
 * that they have.
 */
export async function getQuestionDays(coupleId: string, myId: string, from: string, to: string): Promise<QuestionDay[]> {
  const supabase = await createClient();
  const [answers, signals] = await Promise.all([
    supabase
      .from("question_answers")
      .select("profile_id, day, question, body, updated_at")
      .eq("couple_id", coupleId)
      .gte("day", from)
      .lte("day", to),
    supabase.from("question_signals").select("profile_id, day").eq("couple_id", coupleId).gte("day", from).lte("day", to),
  ]);
  if (answers.error) throw answers.error;
  if (signals.error) throw signals.error;

  const days = new Set([...answers.data.map((a) => a.day), ...signals.data.map((s) => s.day)]);
  return [...days]
    .sort((a, b) => b.localeCompare(a))
    .map((day) => {
      const mine = answers.data.find((a) => a.day === day && a.profile_id === myId);
      const theirs = answers.data.find((a) => a.day === day && a.profile_id !== myId);
      const theyHave = signals.data.some((s) => s.day === day && s.profile_id !== myId);
      return {
        day,
        question: (mine ?? theirs)?.question ?? -1,
        mine: mine ? { body: mine.body, updated_at: mine.updated_at } : null,
        partner: reveal(mine?.body, theirs?.body, theyHave),
      };
    });
}

// ---------------------------------------------------------------------------
// Comments
// ---------------------------------------------------------------------------

export type CommentRow = {
  id: string;
  profile_id: string;
  body: string;
  created_at: string;
  reactions: { profile_id: string; kind: Reaction }[];
};

/** The embed for comments with their reactions, for selects on list_items or watch_nights. */
export const COMMENTS_SELECT = "comments(id, profile_id, body, created_at, comment_reactions(profile_id, kind))";

type CommentJoin = { id: string; profile_id: string; body: string; created_at: string; comment_reactions: { profile_id: string; kind: string }[] };

/** Comments from a join, oldest first, with only reactions the app knows. */
export function toComments(rows: CommentJoin[]): CommentRow[] {
  return rows
    .map((row) => ({
      id: row.id,
      profile_id: row.profile_id,
      body: row.body,
      created_at: row.created_at,
      reactions: row.comment_reactions.flatMap((r) => {
        const kind = asReaction(r.kind);
        return kind ? [{ profile_id: r.profile_id, kind }] : [];
      }),
    }))
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
}

/** A list item's comment thread, oldest first. */
export async function getItemComments(listItemId: string): Promise<CommentRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("comments")
    .select("id, profile_id, body, created_at, comment_reactions(profile_id, kind)")
    .eq("list_item_id", listItemId)
    .order("created_at");
  if (error) throw error;
  return toComments(data);
}

// ---------------------------------------------------------------------------
// Episode reactions
// ---------------------------------------------------------------------------

export type EpisodeReaction = { kind: Reaction; note: string };

/**
 * Both people's episode reactions on a series, keyed by episodeKey(). Your partner's are there only for
 * episodes you've reacted to as well (RLS); `partnerHas` says which ones they've reacted to.
 */
export async function getEpisodeReactions(listItemId: string, myId: string) {
  const supabase = await createClient();
  const [reactions, signals] = await Promise.all([
    supabase.from("episode_reactions").select("profile_id, season, episode, kind, note").eq("list_item_id", listItemId),
    supabase.from("episode_signals").select("profile_id, season, episode").eq("list_item_id", listItemId).neq("profile_id", myId),
  ]);
  if (reactions.error) throw reactions.error;
  if (signals.error) throw signals.error;
  const mine: Record<string, EpisodeReaction> = {};
  const partner: Record<string, EpisodeReaction> = {};
  for (const row of reactions.data) {
    const kind = asReaction(row.kind);
    if (!kind) continue;
    (row.profile_id === myId ? mine : partner)[episodeKey(row.season, row.episode)] = { kind, note: row.note };
  }
  return { mine, partner, partnerHas: signals.data.map((s) => episodeKey(s.season, s.episode)) };
}

type SeasonDetails = { episodes?: { episode_number: number; name: string | null }[] };

/**
 * Episode names for these seasons of a series in the viewer's locale, keyed by episodeKey(): one TMDB
 * request for up to 20 seasons (append_to_response), kept a day in Next's fetch cache. Empty on failure.
 */
export async function getEpisodeNames(tvId: number, seasons: number[], locale: string): Promise<Record<string, string>> {
  const wanted = seasons.slice(0, 20);
  if (wanted.length === 0) return {};
  try {
    const data = await tmdbGet<Record<string, SeasonDetails | unknown>>(
      `/tv/${tvId}`,
      { language: locale, append_to_response: wanted.map((s) => `season/${s}`).join(",") },
      { revalidate: 24 * 60 * 60 },
    );
    const names: Record<string, string> = {};
    for (const season of wanted) {
      const details = data[`season/${season}`] as SeasonDetails | undefined;
      for (const e of details?.episodes ?? []) {
        if (e.name) names[episodeKey(season, e.episode_number)] = e.name;
      }
    }
    return names;
  } catch (error) {
    console.error(`Loading episode names for series ${tvId} failed`, error);
    return {};
  }
}

// ---------------------------------------------------------------------------
// Photos
// ---------------------------------------------------------------------------

export type NightPhoto = {
  id: string;
  uploaded_by: string;
  path: string;
  thumb_path: string;
  bytes: number;
  width: number;
  height: number;
  created_at: string;
};

/** The embed for a night's photos, for selects on watch_nights. */
export const PHOTOS_SELECT = "night_photos(id, uploaded_by, path, thumb_path, bytes, width, height, created_at)";

/** Space the couple's photos take, in bytes. */
export async function getPhotoBytes(coupleId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("night_photos").select("bytes").eq("couple_id", coupleId);
  if (error) throw error;
  return data.reduce((sum, row) => sum + row.bytes, 0);
}

/**
 * Clears the files a cancelled night's album left behind (the rows went with the night). Storage lets either
 * of you remove a gone night's files. Never throws.
 */
export async function clearNightPhotos(coupleId: string, nightId: string) {
  try {
    const supabase = await createClient();
    const folder = `${coupleId}/${nightId}`;
    const { data, error } = await supabase.storage.from(PHOTO_BUCKET).list(folder, { limit: 100 });
    if (error) throw error;
    if (data.length > 0) {
      const removed = await supabase.storage.from(PHOTO_BUCKET).remove(data.map((file) => `${folder}/${file.name}`));
      if (removed.error) throw removed.error;
    }
  } catch (error) {
    console.error(`Clearing the photos of watch night ${nightId} failed`, error);
  }
}
