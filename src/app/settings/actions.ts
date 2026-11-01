"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { getI18n } from "@/lib/i18n/server";
import { isCountry, isLanguage, isTimeZone } from "@/lib/places";
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

/** Streaming services for a country, for the settings form when the country changes. */
export async function loadServices(country: string): Promise<Service[]> {
  await requireProfile();
  return isCountry(country) ? getServices(country) : [];
}
