import "server-only";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";
import { withVisit } from "./places";
import { createClient } from "./supabase/server";

/**
 * Both members of the signed-in user's couple, in one query (RLS shows only your own profile and your
 * partner's). Memoised per request, so getCurrentProfile() and getPartner() share it.
 */
const loadPeople = cache(async () => {
  // Per request: checking the token reads the clock, which Next.js won't allow while prerendering.
  await connection();
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return null;

  const { data: rows } = await supabase.from("profiles").select("*");
  const me = rows?.find((row) => row.id === userId);
  if (!me) return null;
  const partner = me.couple_id ? rows?.find((row) => row.id !== userId && row.couple_id === me.couple_id) : undefined;
  return { me: withVisit(me), partner: partner ? withVisit(partner) : null };
});

/**
 * The signed-in user's profile, or null when signed out. Verifies the session token
 * rather than trusting the cookie. Memoised per request.
 *
 * `country` is where they watch from today: the visited country while a visit is on (same couch mode),
 * else their home country. `home_country` is always their own setting: use it for TMDB locales
 * (`tmdbLocale()`), the settings form and anything that should ignore visits. `visit` is set while away.
 */
export async function getCurrentProfile() {
  return (await loadPeople())?.me ?? null;
}

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
 * The other member of the signed-in user's couple, or null until they've joined. Memoised per request
 * (loaded with your own profile, in the same query). Like getCurrentProfile(), `country` follows their visit
 * and `home_country` is their own setting.
 */
export async function getPartner() {
  return (await loadPeople())?.partner ?? null;
}

export type Profile = NonNullable<Awaited<ReturnType<typeof getCurrentProfile>>>;
