"use server";

import { refresh } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getI18n } from "@/lib/i18n/server";
import { isDateString } from "@/lib/list-rules";
import { isCountry, isLanguage, isTimeZone, visitDateRange } from "@/lib/places";
import { sendPush } from "@/lib/push";
import { getServices, type Service } from "@/lib/services";
import { requireProfile } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

export type SettingsState = { error?: string; saved?: boolean };

export async function saveSettings(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  const [profile, { t }] = await Promise.all([requireProfile(), getI18n()]);
  const errors = t.account.settings.errors;

  const displayName = String(formData.get("display_name") ?? "").trim();
  const country = formData.get("country");
  const language = formData.get("language");
  const timeZone = formData.get("time_zone");

  if (!displayName || displayName.length > 50) return { error: errors.name };
  if (!isCountry(country)) return { error: errors.country };
  if (!isLanguage(language)) return { error: errors.language };
  if (!isTimeZone(timeZone)) return { error: errors.timeZone };

  // Keep only real services for the chosen country.
  const supabase = await createClient();
  const requested = new Set(formData.getAll("services").map(Number));
  const { data: known } = await supabase.from("services").select("provider_id").eq("country", country);
  const services = (known ?? []).map((s) => s.provider_id).filter((id) => requested.has(id));

  const { error } = await supabase
    .from("profiles")
    .update({ display_name: displayName, country, language, time_zone: timeZone, services })
    .eq("id", profile.id);
  if (error) {
    console.error("Saving settings failed", error);
    return { error: errors.saveFailed };
  }

  if (!profile.couple_id) redirect("/couple");
  // Re-render the page and nav, so a new language takes effect straight away.
  refresh();
  return { saved: true };
}

export type VisitState = { error?: string };

/** Same couch mode: "I'm in {country} until {date}". The date is the last day, in the visitor's own zone. */
export async function saveVisit(_prev: VisitState, formData: FormData): Promise<VisitState> {
  const [profile, { t }] = await Promise.all([requireProfile(), getI18n()]);
  const errors = t.places.visit.errors;

  const country = formData.get("visiting_country");
  const until = String(formData.get("visiting_until") ?? "");
  if (!isCountry(country)) return { error: errors.country };
  if (country === profile.home_country) return { error: errors.home };
  const { min, max } = visitDateRange(profile.time_zone);
  if (!isDateString(until) || until < min || until > max) return { error: errors.date };

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ visiting_country: country, visiting_until: until })
    .eq("id", profile.id);
  if (error) {
    console.error("Saving a visit failed", error);
    return { error: errors.saveFailed };
  }
  refresh();
  return {};
}

/** Ends a visit early: back to the home country straight away. */
export async function endVisit(): Promise<VisitState> {
  const [profile, { t }] = await Promise.all([requireProfile(), getI18n()]);
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ visiting_country: null, visiting_until: null })
    .eq("id", profile.id);
  if (error) {
    console.error("Ending a visit failed", error);
    return { error: t.places.visit.errors.saveFailed };
  }
  refresh();
  return {};
}

/** Streaming services for a country, for the settings form when the country changes. */
export async function loadServices(country: string): Promise<Service[]> {
  await requireProfile();
  return isCountry(country) ? getServices(country) : [];
}

/** A browser's push subscription, as PushSubscription.toJSON() gives it. */
export type PushKeys = { endpoint: string; keys: { p256dh: string; auth: string } };

function isPushKeys(value: unknown): value is PushKeys {
  const v = value as PushKeys | null;
  return (
    typeof v?.endpoint === "string" &&
    v.endpoint.startsWith("https://") &&
    v.endpoint.length <= 1000 &&
    typeof v.keys?.p256dh === "string" &&
    v.keys.p256dh.length <= 200 &&
    typeof v.keys?.auth === "string" &&
    v.keys.auth.length <= 100
  );
}

/** Saves this device's subscription, so the daily check can send it notifications. */
export async function savePushSubscription(subscription: PushKeys): Promise<{ error?: string }> {
  const [profile, { t }] = await Promise.all([requireProfile(), getI18n()]);
  if (!isPushKeys(subscription)) return { error: t.account.notifications.failed };

  const supabase = await createClient();
  const row = { profile_id: profile.id, endpoint: subscription.endpoint };
  // Replace rather than upsert: people may add and remove their subscriptions, not edit them.
  const { error: deleteError } = await supabase.from("push_subscriptions").delete().match(row);
  const { error } = deleteError
    ? { error: deleteError }
    : await supabase.from("push_subscriptions").insert({ ...row, ...subscription.keys });
  if (error) {
    console.error("Saving a push subscription failed", error);
    return { error: t.account.notifications.failed };
  }
  return {};
}

/** Forgets this device's subscription after the browser has unsubscribed. */
export async function removePushSubscription(endpoint: string): Promise<{ error?: string }> {
  const [profile, { t }] = await Promise.all([requireProfile(), getI18n()]);
  const supabase = await createClient();
  const { error } = await supabase.from("push_subscriptions").delete().match({ profile_id: profile.id, endpoint });
  if (error) {
    console.error("Removing a push subscription failed", error);
    return { error: t.account.notifications.failed };
  }
  return {};
}

/** Sends a test notification to every device the signed-in person has turned notifications on for. */
export async function sendTestPush(): Promise<{ error?: string }> {
  const [profile, { t }] = await Promise.all([requireProfile(), getI18n()]);
  const origin = (await headers()).get("origin");
  const supabase = await createClient();
  const { data, error } = await supabase.from("push_subscriptions").select("id, endpoint, p256dh, auth");
  if (error || !origin) {
    if (error) console.error("Loading push subscriptions failed", error);
    return { error: t.account.notifications.failed };
  }
  const sent = await sendPush(
    supabase,
    data,
    { title: t.common.appName, body: t.account.notifications.testBody, url: "/settings", tag: `test-${profile.id}` },
    origin,
  );
  return sent > 0 ? {} : { error: t.account.notifications.failed };
}
