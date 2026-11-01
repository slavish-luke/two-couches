import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Source_Sans_3 } from "next/font/google";
import Link from "next/link";
import { Suspense } from "react";
import { HtmlLang } from "@/components/html-lang";
import { countNewAlerts } from "@/lib/alerts";
import { getMessages } from "@/lib/i18n";
import { getI18n } from "@/lib/i18n/server";
import { getCurrentProfile } from "@/lib/session";
import { signOut } from "./auth/actions";
import "./globals.css";

const display = Bricolage_Grotesque({ variable: "--font-display", subsets: ["latin", "latin-ext"] });
const body = Source_Sans_3({ variable: "--font-body", subsets: ["latin", "latin-ext"] });

export const metadata: Metadata = {
  title: "Two Couches",
  description: "Our shared watchlist, across two countries.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f7f8" },
    { media: "(prefers-color-scheme: dark)", color: "#0f1418" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans text-[17px] leading-relaxed">
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
  const [profile, { language, t }] = await Promise.all([getCurrentProfile(), getI18n()]);
  const newAlerts = profile?.couple_id ? await countNewAlerts(profile.alerts_seen_at) : 0;

  return (
    <>
      <HtmlLang language={language} />
      {profile && (
        <nav className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm font-semibold">
          <Link href="/" className="text-muted hover:text-ink">{t.common.nav.list}</Link>
          <Link href="/browse" className="text-muted hover:text-ink">{t.common.nav.browse}</Link>
          <Link href="/coming-soon" className="relative text-muted hover:text-ink">
            {t.common.nav.comingSoon}
            {newAlerts > 0 && (
              <>
                <span aria-hidden className="absolute -right-2 -top-0.5 size-2 rounded-full bg-both" />
                <span className="sr-only"> ({t.common.nav.newAlerts(newAlerts)})</span>
              </>
            )}
          </Link>
          <Link href="/search" className="text-muted hover:text-ink">{t.common.nav.search}</Link>
          <Link href="/settings" className="text-muted hover:text-ink">{t.common.nav.settings}</Link>
          <form action={signOut}>
            <button className="text-muted hover:text-ink">{t.common.nav.signOut}</button>
          </form>
        </nav>
      )}
    </>
  );
}

/** TMDB and JustWatch credit, which their terms require, in the viewer's language. */
async function Attribution() {
  const { t } = await getI18n();
  return t.common.footer;
}
