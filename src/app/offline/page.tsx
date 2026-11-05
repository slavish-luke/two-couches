import { Suspense } from "react";
import { Couch } from "@/components/couch";
import { OfflineSkeleton } from "./skeleton";
import { getI18n, localisedTitle } from "@/lib/i18n/server";

export const generateMetadata = localisedTitle("offline");

// Fetched by the service worker when it installs, and shown for pages it can't load without a connection.
export default function OfflinePage() {
  return (
    <Suspense fallback={<OfflineSkeleton />}>
      <Offline />
    </Suspense>
  );
}

async function Offline() {
  const { t } = await getI18n();
  return (
    <div className="card grid justify-items-center gap-3 px-6 py-10 text-center">
      {/* The couches drifting apart, one tipped over: the line is down. */}
      <span aria-hidden className="mb-2 flex items-end gap-6">
        <Couch who="me" size={64} className="-rotate-6" />
        <Couch who="partner" size={64} className="translate-y-1 rotate-[22deg]" />
      </span>
      <h1 className="display-ink text-[clamp(2rem,5vw,2.6rem)]">{t.common.offlinePage.heading}</h1>
      <p className="max-w-sm font-medium text-muted">{t.common.offlinePage.body}</p>
      {/* A full page load (not <Link>), which the service worker answers from its copy of the list. */}
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
      <a href="/" className="btn mt-3">
        {t.common.offlinePage.openList}
      </a>
    </div>
  );
}
