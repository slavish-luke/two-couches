"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { announceChange } from "@/lib/couple-events";
import { createClient } from "@/lib/supabase/client";

/** Every couple table whose changes show on the list pages (see CoupleSync). */
const TABLES = [
  "list_items", "list_ratings", "reminders", "dismissed_titles", "watch_nights", "ready_checks", "list_reviews", "review_signals", "night_wrapups", "night_proposals", "night_prep_items", "rating_guesses", "rewatches", "rewatch_ratings", "season_ratings", "cant_wait",
  // Sprint 20: nudges, the day's question (signals carry your partner's hidden answer), comments, episode reactions, photos.
  "nudges", "question_answers", "question_signals", "comments", "comment_reactions", "episode_reactions", "episode_signals", "night_photos",
  // Sprint 21: titles sent to each other, season reviews (signals carry your partner's hidden one).
  "title_sends", "season_reviews", "season_review_signals",
];

/**
 * Who made a change, where the row says so for sure. Only these are used to skip the echo of your own saves:
 * rows each person writes only for themselves (RLS), rows stamped by a trigger, and inserts of rows that name
 * who added them. Anything else (deletes, a tick on a prep item, an answer to a send) always refreshes.
 */
const ACTOR: Record<string, string> = {
  list_items: "updated_by",
  watch_nights: "updated_by",
  reminders: "created_by",
  dismissed_titles: "dismissed_by",
  ...Object.fromEntries(
    ["list_ratings", "season_ratings", "rewatch_ratings", "list_reviews", "review_signals", "night_wrapups", "rating_guesses", "cant_wait", "ready_checks", "question_answers", "question_signals", "comments", "comment_reactions", "episode_reactions", "episode_signals", "season_reviews", "season_review_signals"].map((t) => [t, "profile_id"]),
  ),
};
const INSERT_ACTOR: Record<string, string> = {
  rewatches: "added_by",
  night_prep_items: "added_by",
  night_proposals: "proposed_by",
  night_photos: "uploaded_by",
  title_sends: "from_profile",
  nudges: "from_profile",
};

/** Your own save, made from this device a moment ago: its Server Action already refreshed the page. */
const OWN_ECHO_MS = 8000;

// Shared between CoupleSync (one per app) and the ListSync markers on list pages.
const sync = {
  live: 0,
  /** A change arrived (or the app slept) while no list page was showing: refresh the next one that shows. */
  dirty: false,
  lastInput: 0,
  refresh: null as null | (() => void),
};

/**
 * The app's one live link to the couple's rows (rendered once, in the layout, for paired users): it stays
 * subscribed across navigations, so moving between pages never drops or rejoins the channel. When either
 * person changes the list, reminders, dismissals, watch nights, ready checks, reviews, wrap-ups, guesses,
 * proposals, prep lists, rewatches, ratings, "Can't wait" marks, nudges, questions, comments, reactions,
 * photos, sends or season reviews, a page showing list data (one with a <ListSync> marker) re-renders, so an
 * add on one screen appears on the other without reloading. Pages without the marker (Settings, the watch
 * room, the swipe deck…) are left alone; the next list page refreshes once when it shows, so a copy the tab
 * bar prefetched earlier never stays stale. Your own saves from this device aren't refreshed twice: their
 * Server Action already did (OWN_ECHO_MS). review_signals stand in for your partner's hidden review (RLS keeps
 * list_reviews from sending it until you've written yours). Renders nothing.
 */
export function CoupleSync({ coupleId, myId }: { coupleId: string; myId: string }) {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    let timer: ReturnType<typeof setTimeout> | undefined;
    // One refresh for a burst of changes, e.g. a status and a rating saved together.
    const refresh = () => {
      clearTimeout(timer);
      timer = setTimeout(() => router.refresh(), 250);
    };
    sync.refresh = refresh;
    const stale = () => {
      if (sync.live > 0) refresh();
      else sync.dirty = true;
    };
    const ownEcho = (payload: { table: string; eventType: string; new: Record<string, unknown> }) => {
      const key = ACTOR[payload.table] ?? (payload.eventType === "INSERT" ? INSERT_ACTOR[payload.table] : undefined);
      return key !== undefined && payload.new?.[key] === myId && Date.now() - sync.lastInput < OWN_ECHO_MS;
    };
    // Sprint 27: each insert and update also goes to a list page (your partner's couch peeks in with it).
    const changed = (payload: Parameters<typeof announceChange>[0] & { new: Record<string, unknown> }) => {
      if (!ownEcho(payload)) stale();
      if (sync.live > 0) announceChange(payload);
    };
    const filter = `couple_id=eq.${coupleId}`;

    const channel = supabase.channel(`list:${coupleId}`);
    for (const table of TABLES) {
      channel
        .on("postgres_changes", { event: "INSERT", schema: "public", table, filter }, changed)
        .on("postgres_changes", { event: "UPDATE", schema: "public", table, filter }, changed)
        // Realtime can't filter deletes, and they carry only the row's key, so any couple's delete
        // arrives here. At worst that costs an extra refresh.
        .on("postgres_changes", { event: "DELETE", schema: "public", table }, stale);
    }
    // Join as the signed-in user, not anonymously: Realtime applies RLS with this token, so without it no
    // inserts or updates come through. The session loads from the cookie asynchronously.
    let cancelled = false;
    supabase.auth.getSession().then(async ({ data }) => {
      if (cancelled) return;
      await supabase.realtime.setAuth(data.session?.access_token ?? null);
      if (!cancelled) channel.subscribe();
    });

    // Catch up on anything missed while the tab was asleep (phones drop the socket in the background).
    const onVisible = () => {
      if (document.visibilityState === "visible") stale();
    };
    const onInput = () => {
      sync.lastInput = Date.now();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("pointerdown", onInput, { capture: true, passive: true });
    window.addEventListener("keydown", onInput, { capture: true, passive: true });

    return () => {
      cancelled = true;
      clearTimeout(timer);
      if (sync.refresh === refresh) sync.refresh = null;
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pointerdown", onInput, { capture: true });
      window.removeEventListener("keydown", onInput, { capture: true });
      supabase.removeChannel(channel);
    };
  }, [coupleId, myId, router]);

  return null;
}

/**
 * Marks a page that shows list data, so live changes re-render it (CoupleSync does the listening). If
 * something changed while no list page was showing, the page refreshes once as it appears. Renders nothing.
 */
export function ListSync() {
  useEffect(() => {
    sync.live += 1;
    if (sync.dirty) {
      sync.dirty = false;
      sync.refresh?.();
    }
    return () => {
      sync.live -= 1;
    };
  }, []);
  return null;
}
