import { createHash, timingSafeEqual } from "node:crypto";
import { KEEP_WARM_HEADER } from "@/lib/keep-warm";

// Called every 5 minutes by pg_cron (see request_keep_warm() in the migrations) with the shared secret.
export const maxDuration = 30;

/** The pages the couple opens most: each request starts (or keeps) the server function behind it. */
const PATHS = ["/", "/browse", "/coming-soon", "/watch-nights", "/stats", "/title/movie/550", "/search", "/settings"];

function digest(value: string) {
  return createHash("sha256").update(value).digest();
}

/** Compares in constant time, so the secret can't be guessed a character at a time. */
function isAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return timingSafeEqual(digest(request.headers.get("authorization") ?? ""), digest(`Bearer ${secret}`));
}

/**
 * Keeps the app's server functions warm, so the first tap after a quiet spell doesn't wait for a cold start
 * (0.8–1 s measured on 2026-11-15). Each page is asked for without a session: the proxy lets it through only
 * with the secret header, the page renders signed out and redirects to /login, so nothing of the couple's is
 * ever sent. Answers with each page's status.
 */
export async function POST(request: Request) {
  if (!isAuthorized(request)) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const origin = new URL(request.url).origin;
  const results = await Promise.allSettled(
    PATHS.map(async (path) => {
      const response = await fetch(origin + path, {
        headers: { [KEEP_WARM_HEADER]: process.env.CRON_SECRET! },
        redirect: "manual",
        cache: "no-store",
        signal: AbortSignal.timeout(20_000),
      });
      await response.body?.cancel();
      return response.status;
    }),
  );
  return Response.json(
    Object.fromEntries(PATHS.map((path, i) => [path, results[i].status === "fulfilled" ? results[i].value : "failed"])),
  );
}
