import "server-only";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";
import { withVisit } from "./places";
import { createClient } from "./supabase/server";

/**
 * The signed-in user's profile, or null when signed out. Verifies the session token
 * rather than trusting the cookie. Memoised per request.
 *
 * `country` is where they watch from today: the visited country while a visit is on (same couch mode),
 * else their home country. `home_country` is always their own setting: use it for TMDB locales
 * (`tmdbLocale()`), the settings form and anything that should ignore visits. `visit` is set while away.
 */
export const getCurrentProfile = cache(async () => {
  // Per request: checking the token reads the clock, which Next.js won't allow while prerendering.
  await connection();
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return null;

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", userId).single();
  return profile ? withVisit(profile) : null;
});

/** Like getCurrentProfile, but redirects to /login when signed out. */
export async function requireProfile() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  return profile;
}

/** Like requireProfile, for actions that need a couple and a country. Throws until setup is finished. */
export async function requireCoupleProfile() {
  const profile = await requireProfile();
  if (!profile.couple_id || !profile.country) throw new Error("Finish setting up before using the list");
  return { ...profile, couple_id: profile.couple_id, country: profile.country };
}

/**
 * The other member of the signed-in user's couple, or null until they've joined. Memoised per request.
 * Like getCurrentProfile(), `country` follows their visit and `home_country` is their own setting.
 */
export const getPartner = cache(async () => {
  const profile = await getCurrentProfile();
  if (!profile?.couple_id) return null;

  const supabase = await createClient();
  const { data: partner } = await supabase
    .from("profiles")
    .select("id, display_name, country, language, time_zone, services, visiting_country, visiting_until")
    .eq("couple_id", profile.couple_id)
    .neq("id", profile.id)
    .maybeSingle();
  return partner ? withVisit(partner) : null;
});

export type Profile = NonNullable<Awaited<ReturnType<typeof getCurrentProfile>>>;
