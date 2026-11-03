import { Suspense } from "react";
import { PageLoading } from "@/components/page-loading";
import { getI18n, localisedTitle } from "@/lib/i18n/server";

export const generateMetadata = localisedTitle("offline");

// Fetched by the service worker when it installs, and shown for pages it can't load without a connection.
export default function OfflinePage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <Offline />
    </Suspense>
  );
}

async function Offline() {
  const { t } = await getI18n();
  return (
    <div className="card grid justify-items-center gap-2 py-12 text-center">
      <h1 className="font-display text-2xl font-bold tracking-tight">{t.common.offlinePage.heading}</h1>
      <p className="max-w-sm text-muted">{t.common.offlinePage.body}</p>
      {/* A full page load (not <Link>), which the service worker answers from its copy of the list. */}
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
      <a href="/" className="btn mt-2">
        {t.common.offlinePage.openList}
      </a>
    </div>
  );
}
