import { createHash, timingSafeEqual } from "node:crypto";
import { runNightReminders } from "@/lib/night-reminders";

// Called every 15 minutes by pg_cron (see request_night_reminders() in the migrations) with the shared secret.
export const maxDuration = 60;

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
    const report = await runNightReminders(new URL(request.url).origin);
    // Counts only in the logs: the messages carry the couple's notes.
    console.log("Night reminders finished", {
      checked: report.checked,
      sent: report.sent.map((s) => ({ night: s.night, kind: s.kind, devices: s.to.reduce((n, p) => n + p.devices, 0) })),
    });
    return Response.json(report);
  } catch (error) {
    console.error("Night reminders failed", error);
    return Response.json({ error: "Night reminders failed" }, { status: 500 });
  }
}
