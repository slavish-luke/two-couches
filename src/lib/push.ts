import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { sendNotification, WebPushError } from "web-push";
import type { Database } from "./supabase/database.types";

/** Web push needs a VAPID key pair: the public half is also given to browsers when they subscribe. */
export function isPushConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

/**
 * What public/sw.js shows. `url` is opened (relative to the app) when the notification is tapped. `badge`
 * (appBadgeCount()) sets the number on the installed app's icon, where the browser supports it.
 */
export type PushMessage = { title: string; body: string; url: string; tag?: string; badge?: number };

type Subscription = Pick<Database["public"]["Tables"]["push_subscriptions"]["Row"], "id" | "endpoint" | "p256dh" | "auth">;

/**
 * Sends a message to each of these devices and forgets the ones whose subscription has ended (the
 * person turned notifications off or the browser dropped it). `contact` is the app's own https URL,
 * which push services use to reach whoever runs it. Returns how many devices accepted it.
 */
export async function sendPush(
  client: SupabaseClient<Database>,
  subscriptions: Subscription[],
  message: PushMessage,
  contact: string,
) {
  if (!isPushConfigured() || subscriptions.length === 0) return 0;
  const vapidDetails = {
    // Push services take only https: or mailto: contacts, and local dev runs on http.
    subject: contact.startsWith("https://") ? contact : "mailto:dev@example.com",
    publicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    privateKey: process.env.VAPID_PRIVATE_KEY!,
  };

  const outcomes = await Promise.allSettled(
    subscriptions.map((s) =>
      sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(message), {
        vapidDetails,
        TTL: 24 * 60 * 60,
      }),
    ),
  );

  const ended: string[] = [];
  outcomes.forEach((outcome, i) => {
    if (outcome.status === "fulfilled") return;
    const { reason } = outcome;
    if (reason instanceof WebPushError && (reason.statusCode === 404 || reason.statusCode === 410)) {
      ended.push(subscriptions[i].id);
    } else {
      console.error("Sending a push notification failed", reason);
    }
  });
  if (ended.length > 0) {
    const { error } = await client.from("push_subscriptions").delete().in("id", ended);
    if (error) console.error("Forgetting ended push subscriptions failed", error);
  }
  return outcomes.filter((o) => o.status === "fulfilled").length;
}
