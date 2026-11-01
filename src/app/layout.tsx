import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Source_Sans_3 } from "next/font/google";
import Link from "next/link";
import { Suspense } from "react";
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
          Film and TV data from TMDB. This product uses the TMDB API but is not endorsed or certified by TMDB.
          Streaming availability from JustWatch.
        </footer>
      </body>
    </html>
  );
}

async function AccountNav() {
  const profile = await getCurrentProfile();
  if (!profile) return null;

  return (
    <nav className="flex items-center gap-4 text-sm font-semibold">
      <Link href="/" className="text-muted hover:text-ink">Our list</Link>
      <Link href="/settings" className="text-muted hover:text-ink">Settings</Link>
      <form action={signOut}>
        <button className="text-muted hover:text-ink">Sign out</button>
      </form>
    </nav>
  );
}
