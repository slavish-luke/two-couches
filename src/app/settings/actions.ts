"use server";

import { redirect } from "next/navigation";
import { isCountry, isLanguage, isTimeZone } from "@/lib/places";
import { getServices, type Service } from "@/lib/services";
import { requireProfile } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

export type SettingsState = { error?: string; saved?: boolean };

export async function saveSettings(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  const profile = await requireProfile();

  const displayName = String(formData.get("display_name") ?? "").trim();
  const country = formData.get("country");
  const language = formData.get("language");
  const timeZone = formData.get("time_zone");

  if (!displayName || displayName.length > 50) return { error: "Enter a name of up to 50 characters." };
  if (!isCountry(country)) return { error: "Pick your country." };
  if (!isLanguage(language)) return { error: "Pick a language." };
  if (!isTimeZone(timeZone)) return { error: "Pick your time zone." };

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
    return { error: "Couldn't save. Try again." };
  }

  if (!profile.couple_id) redirect("/couple");
  return { saved: true };
}

/** Streaming services for a country, for the settings form when the country changes. */
export async function loadServices(country: string): Promise<Service[]> {
  await requireProfile();
  return isCountry(country) ? getServices(country) : [];
}
