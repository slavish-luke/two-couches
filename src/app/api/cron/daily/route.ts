import { createHash, timingSafeEqual } from "node:crypto";
import { runDailyCheck } from "@/lib/daily-check";

// Called once a day by pg_cron (see request_daily_check() in the migrations) with the shared secret.
export const maxDuration = 300;

function digest(value: string) {
  return createHash("sha256").update(value).digest();
}

/** Compares in constant time, so the secret can't be guessed a character at a time. */
function isAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return timingSafeEqual(digest(request.headers.get("authorization") ?? ""), digest(`Bearer ${secret}`));
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const result = await runDailyCheck(new URL(request.url).origin);
    console.log("Daily check finished", result);
    return Response.json(result);
  } catch (error) {
    console.error("Daily check failed", error);
    return Response.json({ error: "Daily check failed" }, { status: 500 });
  }
}
