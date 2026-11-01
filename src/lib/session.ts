import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { createClient } from "./supabase/server";

/**
 * The signed-in user's profile, or null when signed out. Verifies the session token
 * rather than trusting the cookie. Memoised per request.
 */
export const getCurrentProfile = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return null;

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", userId).single();
  return profile;
});

/** Like getCurrentProfile, but redirects to /login when signed out. */
export async function requireProfile() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  return profile;
}

export type Profile = NonNullable<Awaited<ReturnType<typeof getCurrentProfile>>>;
