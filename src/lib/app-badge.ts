import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { proposalView } from "./planning-rules";
import type { Database } from "./supabase/database.types";

/**
 * The number on the installed app's icon (Badging API) for one person: alerts that arrived since they last
 * opened Coming soon, plus times their partner proposed that are waiting for their answer. Works with the
 * signed-in user's client (the layout) or the admin client (pushes). 0 on any error: the badge is an extra.
 */
export async function appBadgeCount(
  client: SupabaseClient<Database>,
  person: { id: string; couple_id: string | null; alerts_seen_at: string },
) {
  if (!person.couple_id) return 0;
  const [alerts, proposals] = await Promise.all([
    client
      .from("alerts")
      .select("id", { count: "exact", head: true })
      .eq("couple_id", person.couple_id)
      .gt("created_at", person.alerts_seen_at),
    client
      .from("night_proposals")
      .select("status, proposed_by, times")
      .eq("couple_id", person.couple_id)
      .eq("status", "open")
      .neq("proposed_by", person.id),
  ]);
  if (alerts.error) console.error("Counting alerts for the app badge failed", alerts.error);
  if (proposals.error) console.error("Counting proposals for the app badge failed", proposals.error);
  const now = new Date();
  const waiting = (proposals.data ?? []).filter((p) => proposalView(p, person.id, now) === "answer").length;
  return (alerts.count ?? 0) + waiting;
}
