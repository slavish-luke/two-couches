import { after } from "next/server";
import { getCurrentProfile, getPartner } from "@/lib/session";
import { warmCaches } from "@/lib/warm";

// A cold start can check a few hundred titles against TMDB; the answer itself goes back straight away.
export const maxDuration = 60;

/**
 * Called by <WarmUp> soon after the app opens: fills the caches behind Browse and Coming soon (see
 * warmCaches()) after answering, so those pages don't wait on TMDB when they're opened.
 */
export async function POST() {
  const profile = await getCurrentProfile();
  if (!profile) return new Response(null, { status: 401 });
  const partner = await getPartner();
  after(() => warmCaches(profile, partner));
  return new Response(null, { status: 202 });
}
