import type { Metadata, Viewport } from "next";
import { Fredoka, Luckiest_Guy } from "next/font/google";
import Link from "next/link";
import { Suspense } from "react";
import { preconnect } from "react-dom";
import { AppNav } from "@/components/app-nav";
import { Couches } from "@/components/couch";
import { FlightDeck } from "@/components/flight-deck";
import { HtmlLang } from "@/components/html-lang";
import { Intro } from "@/components/intro";
import { OfflineChip } from "@/components/offline-chip";
import { PwaSetup } from "@/components/pwa";
import { WarmUp } from "@/components/warm-up";
import { countNewAlerts } from "@/lib/alerts";
import { getMessages } from "@/lib/i18n";
import { getI18n } from "@/lib/i18n/server";
import { getCurrentProfile } from "@/lib/session";
import { DEFAULT_LOOK, LOOK_SCRIPT, PALETTE_COLORS } from "@/lib/theme";
import "./globals.css";

// Saturday Morning's faces: Luckiest Guy for cartoon lettering, Fredoka for reading. Both cover Turkish.
// A later skin's fonts are declared with preload: false, so only the active skin's fonts download.
const luckiest = Luckiest_Guy({ variable: "--font-luckiest", weight: "400", subsets: ["latin", "latin-ext"] });
const fredoka = Fredoka({ variable: "--font-fredoka", subsets: ["latin", "latin-ext"] });

const TMDB_IMAGES = "https://image.tmdb.org";

export const metadata: Metadata = {
  title: "Two Couches",
  description: "Our shared watchlist, across two countries.",
  robots: { index: false, follow: false },
  appleWebApp: { capable: true, title: "Two Couches", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  // Lets the phone tab bar sit above the iPhone home indicator (env(safe-area-inset-bottom)).
  viewportFit: "cover",
  // The standard palette's ground; LOOK_SCRIPT points it at this device's palette.
  themeColor: PALETTE_COLORS[DEFAULT_LOOK.palette].ground,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  // Opens the connection to TMDB's image server while the page loads (DNS, TCP and TLS take several round
  // trips), before the first poster is asked for. The service worker fetches posters with CORS, which
  // browsers keep on a separate connection, hence both.
  preconnect(TMDB_IMAGES);
  preconnect(TMDB_IMAGES, { crossOrigin: "anonymous" });
  return (
    // LOOK_SCRIPT swaps in this device's look before React hydrates, hence suppressHydrationWarning.
    <html
      lang="en"
      data-skin={DEFAULT_LOOK.skin}
      data-palette={DEFAULT_LOOK.palette}
      suppressHydrationWarning
      className={`${luckiest.variable} ${fredoka.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: LOOK_SCRIPT }} />
      </head>
      <body className="flex min-h-full flex-col font-sans text-[17px] leading-relaxed">
        <PwaSetup />
        {/* Stays put while pages whoosh and peel beneath it. */}
        <header style={{ viewTransitionName: "site-header" }} className="relative z-20">
          <div className="mx-auto flex max-w-[90rem] items-center justify-between gap-2 px-4 pb-2 pt-4 sm:gap-4 sm:px-6 lg:px-8 lg:pt-5">
            <Link
              href="/"
              className="group flex min-w-0 -rotate-2 items-center gap-1.5 transition duration-200 ease-(--ease-spring) hover:-rotate-4 hover:scale-105"
            >
              <span data-logo-couches className="inline-flex">
                <Couches size={38} className="sm:hidden" />
                <Couches size={54} className="max-sm:hidden" />
              </span>
              <span className="display whitespace-nowrap text-[1.4rem] min-[400px]:text-[1.6rem] sm:text-[2.3rem]">Two Couches</span>
            </Link>
            <Suspense>
              <AccountNav />
            </Suspense>
          </div>
        </header>
        <Intro />
        <main className="mx-auto w-full max-w-[90rem] flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
        <footer className="mx-auto w-full max-w-[90rem] px-4 pb-6 pt-2 sm:px-6 lg:px-8">
          <p className="mx-auto max-w-[48rem] rounded-panel border-[3px] border-outline bg-surface px-4 py-3 text-sm text-muted">
            <Suspense fallback={getMessages("en").common.footer}>
              <Attribution />
            </Suspense>
          </p>
        </footer>
      </body>
    </html>
  );
}

async function AccountNav() {
  const [profile, { language }] = await Promise.all([getCurrentProfile(), getI18n()]);
  const newAlerts = profile?.couple_id ? await countNewAlerts(profile.alerts_seen_at) : 0;

  return (
    <>
      <HtmlLang language={language} />
      {profile && (
        <>
          <OfflineChip language={language} />
          <AppNav newAlerts={newAlerts} language={language} />
          <FlightDeck language={language} />
          {profile.couple_id && <WarmUp />}
        </>
      )}
    </>
  );
}

/** TMDB and JustWatch credit, which their terms require, in the viewer's language. */
async function Attribution() {
  const { t } = await getI18n();
  return t.common.footer;
}
