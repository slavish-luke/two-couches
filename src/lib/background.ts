import "server-only";
import { after } from "next/server";

/**
 * Runs `task` after the response has been sent (Next's `after()`), so cache writes and stale refreshes never
 * hold up a page. Outside a request (where `after()` throws) it runs straight away and is awaited. Errors are
 * logged, never thrown: the work is a cache refresh, and the page already has what it needs.
 */
export async function inBackground(label: string, task: () => Promise<unknown>): Promise<void> {
  const run = () =>
    task().catch((error) => {
      console.error(`${label} failed`, error);
    });
  try {
    after(run);
  } catch {
    await run();
  }
}
