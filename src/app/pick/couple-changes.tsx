"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Calls `onChange` (at most once per burst of changes) whenever either of you changes a row of `table` in
 * your couple, and when the tab comes back into view (phones drop the socket in the background). Joins
 * Realtime as the signed-in user, so RLS lets the rows through, as ListSync does.
 */
export function useCoupleChanges(coupleId: string, table: "moods" | "swipes" | "free_evenings", onChange: () => void) {
  const latest = useRef(onChange);
  useEffect(() => {
    latest.current = onChange;
  });

  useEffect(() => {
    const supabase = createClient();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const changed = () => {
      clearTimeout(timer);
      timer = setTimeout(() => latest.current(), 250);
    };
    const filter = `couple_id=eq.${coupleId}`;
    const channel = supabase
      .channel(`${table}:${coupleId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table, filter }, changed)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table, filter }, changed)
      // Realtime can't filter deletes; another couple's delete costs at most an extra check.
      .on("postgres_changes", { event: "DELETE", schema: "public", table }, changed);

    let cancelled = false;
    supabase.auth.getSession().then(async ({ data }) => {
      if (cancelled) return;
      await supabase.realtime.setAuth(data.session?.access_token ?? null);
      if (!cancelled) channel.subscribe();
    });
    const onVisible = () => {
      if (document.visibilityState === "visible") changed();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
      supabase.removeChannel(channel);
    };
  }, [coupleId, table]);
}

/** Re-renders the page when either of you picks a new mood, so the pick or the deck is dealt again. Renders nothing. */
export function MoodSync({ coupleId }: { coupleId: string }) {
  const router = useRouter();
  useCoupleChanges(coupleId, "moods", () => router.refresh());
  return null;
}
