/**
 * The header the keep-warm job (src/app/api/cron/keep-warm/route.ts) sends with CRON_SECRET. With it, the proxy
 * lets a request without a session reach its page, which then renders signed out (a redirect to /login).
 */
export const KEEP_WARM_HEADER = "x-keep-warm";

/** Whether `value` is the cron secret, compared in constant time (works in the proxy, no node:crypto). */
export function isKeepWarmSecret(value: string | null): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || value === null || value.length !== secret.length) return false;
  let diff = 0;
  for (let i = 0; i < secret.length; i++) diff |= value.charCodeAt(i) ^ secret.charCodeAt(i);
  return diff === 0;
}
