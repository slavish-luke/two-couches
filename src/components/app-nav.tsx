"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { getMessages } from "@/lib/i18n";

type Section = "list" | "browse" | "comingSoon" | "watchNights" | "stats";

const SECTIONS: { key: Section; href: string; icon: ReactNode }[] = [
  {
    key: "list",
    href: "/",
    icon: (
      <>
        <path d="M9 6h11M9 12h11M9 18h11" />
        <circle cx="4.5" cy="6" r="1" fill="currentColor" />
        <circle cx="4.5" cy="12" r="1" fill="currentColor" />
        <circle cx="4.5" cy="18" r="1" fill="currentColor" />
      </>
    ),
  },
  {
    key: "browse",
    href: "/browse",
    icon: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="m15.5 8.5-2 5-5 2 2-5z" />
      </>
    ),
  },
  {
    key: "comingSoon",
    href: "/coming-soon",
    icon: <path d="M6 16v-5a6 6 0 1 1 12 0v5l1.5 2h-15zM10 20.5a2 2 0 0 0 4 0" />,
  },
  {
    key: "watchNights",
    href: "/watch-nights",
    icon: <path d="M19.5 14.5A8 8 0 1 1 9.5 4.5a6.5 6.5 0 0 0 10 10z" />,
  },
  { key: "stats", href: "/stats", icon: <path d="M5 20v-7M12 20V5M19 20v-10" /> },
];

const SEARCH_ICON = <path d="M10.5 17.5a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4.5-4.5" />;
const SETTINGS_ICON = (
  <>
    <path d="M4 7h9M17 7h3M4 17h3M11 17h9" />
    <circle cx="15" cy="7" r="2" />
    <circle cx="9" cy="17" r="2" />
  </>
);

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-6"
    >
      {children}
    </svg>
  );
}

function isCurrent(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * The signed-in navigation. Wide screens get one row of links in the header; phones get Search and
 * Settings in the header and the main sections in a tab bar along the bottom.
 */
export function AppNav({ newAlerts, language }: { newAlerts: number; language: string }) {
  const pathname = usePathname();
  const t = getMessages(language).common.nav;
  const current = (href: string) => (isCurrent(pathname, href) ? "page" : undefined);
  const alertDot = (className: string) =>
    newAlerts > 0 && (
      <>
        <span aria-hidden className={`absolute size-2 rounded-full bg-both ${className}`} />
        <span className="sr-only"> ({t.newAlerts(newAlerts)})</span>
      </>
    );

  return (
    <>
      <nav aria-label={t.label} className="hidden flex-wrap items-center gap-x-4 gap-y-1 text-sm font-semibold sm:flex">
        {[...SECTIONS, { key: "search" as const, href: "/search" }, { key: "settings" as const, href: "/settings" }].map(
          ({ key, href }) => (
            <Link
              key={key}
              href={href}
              aria-current={current(href)}
              className="relative text-muted hover:text-ink aria-[current=page]:text-ink"
            >
              {t[key]}
              {key === "comingSoon" && alertDot("-right-2 -top-0.5")}
            </Link>
          ),
        )}
      </nav>

      <div className="flex items-center gap-1 sm:hidden">
        {(
          [
            ["search", "/search", SEARCH_ICON],
            ["settings", "/settings", SETTINGS_ICON],
          ] as const
        ).map(([key, href, icon]) => (
          <Link
            key={key}
            href={href}
            aria-current={current(href)}
            aria-label={t[key]}
            className="grid size-10 place-items-center rounded-lg text-muted hover:text-ink aria-[current=page]:text-ink"
          >
            <Icon>{icon}</Icon>
          </Link>
        ))}
      </div>

      <nav
        data-tab-bar
        aria-label={t.label}
        className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur sm:hidden"
      >
        <ul className="mx-auto grid max-w-md grid-cols-5">
          {SECTIONS.map(({ key, href, icon }) => (
            <li key={key}>
              <Link
                href={href}
                aria-current={current(href)}
                className="relative flex flex-col items-center gap-0.5 px-1 pb-1.5 pt-2 text-[11px] font-semibold text-muted aria-[current=page]:text-ink"
              >
                <span className="relative">
                  <Icon>{icon}</Icon>
                  {key === "comingSoon" && alertDot("-right-0.5 top-0")}
                </span>
                <span className="max-w-full truncate">{t.short[key]}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}
