"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Re-renders the page when either person changes the couple's list, reminders, dismissals, watch nights,
 * ready checks, reviews, wrap-ups or rating guesses, so an add on one screen appears on the other without reloading.
 * review_signals stand in for your partner's hidden review (RLS keeps list_reviews from sending it until
 * you've written yours), so "{name} has written theirs" arrives live too. Renders nothing.
 */
export function ListSync({ coupleId }: { coupleId: string }) {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    let timer: ReturnType<typeof setTimeout> | undefined;
    // One refresh for a burst of changes, e.g. a status and a rating saved together.
    const refresh = () => {
      clearTimeout(timer);
      timer = setTimeout(() => router.refresh(), 250);
    };
    const filter = `couple_id=eq.${coupleId}`;

    const channel = supabase.channel(`list:${coupleId}`);
    for (const table of ["list_items", "list_ratings", "reminders", "dismissed_titles", "watch_nights", "ready_checks", "list_reviews", "review_signals", "night_wrapups", "rating_guesses"]) {
      channel
        .on("postgres_changes", { event: "INSERT", schema: "public", table, filter }, refresh)
        .on("postgres_changes", { event: "UPDATE", schema: "public", table, filter }, refresh)
        // Realtime can't filter deletes, and they carry only the row's key, so any couple's delete
        // arrives here. At worst that costs an extra refresh.
        .on("postgres_changes", { event: "DELETE", schema: "public", table }, refresh);
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
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
      supabase.removeChannel(channel);
    };
  }, [coupleId, router]);

  return null;
}
