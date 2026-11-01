import "server-only";
import type { Country } from "./places";
import { createAdminClient } from "./supabase/admin";
import { createClient } from "./supabase/server";
import { fetchWatchProviders, isTmdbConfigured } from "./tmdb";

const MAX_AGE_MS = 24 * 60 * 60 * 1000;

export type Service = { provider_id: number; name: string; logo_path: string | null };

/**
 * Streaming services available in a country, sorted by TMDB's display priority.
 * Served from the Supabase cache and refreshed from TMDB when older than a day.
 */
export async function getServices(country: Country): Promise<Service[]> {
  const supabase = await createClient();
  const { data: cached } = await supabase
    .from("services")
    .select("provider_id, name, logo_path, refreshed_at")
    .eq("country", country)
    .order("display_priority")
    .order("name");

  const isFresh =
    cached && cached.length > 0 && cached.every((s) => Date.now() - Date.parse(s.refreshed_at) < MAX_AGE_MS);
  const admin = createAdminClient();
  if (isFresh || !admin || !isTmdbConfigured()) return cached ?? [];

  try {
    const refreshedAt = new Date().toISOString();
    const providers = await fetchWatchProviders(country);
    const rows = providers.map((p) => ({ ...p, country, refreshed_at: refreshedAt }));

    const { error: upsertError } = await admin.from("services").upsert(rows);
    if (upsertError) throw upsertError;
    // Drop services TMDB no longer lists for this country.
    await admin.from("services").delete().eq("country", country).lt("refreshed_at", refreshedAt);

    return providers
      .sort((a, b) => a.display_priority - b.display_priority || a.name.localeCompare(b.name))
      .map(({ provider_id, name, logo_path }) => ({ provider_id, name, logo_path }));
  } catch (error) {
    console.error(`Refreshing ${country} services from TMDB failed`, error);
    return cached ?? [];
  }
}
