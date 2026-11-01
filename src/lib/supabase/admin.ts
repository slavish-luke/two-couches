import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

/**
 * Supabase client using the secret key. It bypasses RLS, so use it only for shared caches
 * that no user owns (e.g. the streaming-service catalogue), never for couple data.
 * Returns null when the key isn't configured.
 */
export function createAdminClient() {
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!secretKey) return null;

  return createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
