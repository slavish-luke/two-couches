import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Source_Sans_3 } from "next/font/google";
import Link from "next/link";
import { Suspense } from "react";
import { preconnect } from "react-dom";
import { AppNav } from "@/components/app-nav";
import { HtmlLang } from "@/components/html-lang";
import { OfflineChip } from "@/components/offline-chip";
import { PwaSetup } from "@/components/pwa";
import { WarmUp } from "@/components/warm-up";
import { countNewAlerts } from "@/lib/alerts";
import { getMessages } from "@/lib/i18n";
import { getI18n } from "@/lib/i18n/server";
import { getCurrentProfile } from "@/lib/session";
import { THEME_COLORS, THEME_SCRIPT } from "@/lib/theme";
import "./globals.css";

const display = Bricolage_Grotesque({ variable: "--font-display", subsets: ["latin", "latin-ext"] });
const body = Source_Sans_3({ variable: "--font-body", subsets: ["latin", "latin-ext"] });

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
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: THEME_COLORS.light },
    { media: "(prefers-color-scheme: dark)", color: THEME_COLORS.dark },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  // Opens the connection to TMDB's image server while the page loads (DNS, TCP and TLS take several round
  // trips), before the first poster is asked for. The service worker fetches posters with CORS, which
  // browsers keep on a separate connection, hence both.
  preconnect(TMDB_IMAGES);
  preconnect(TMDB_IMAGES, { crossOrigin: "anonymous" });
  return (
    // The theme script sets data-theme before React hydrates, hence suppressHydrationWarning.
    <html lang="en" suppressHydrationWarning className={`${display.variable} ${body.variable} h-full antialiased`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="flex min-h-full flex-col font-sans text-[17px] leading-relaxed">
        <PwaSetup />
        <header className="border-b border-line bg-surface">
          <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 px-4 py-3">
            <Link href="/" className="font-display text-xl font-bold tracking-tight">
              Two Couches
            </Link>
            <Suspense>
              <AccountNav />
            </Suspense>
          </div>
        </header>
        <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">{children}</main>
        <footer className="border-t border-line px-4 py-5 text-center text-sm text-muted">
          <Suspense fallback={getMessages("en").common.footer}>
            <Attribution />
          </Suspense>
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
