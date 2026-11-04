"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { flightTypes } from "@/lib/flight";
import { getMessages } from "@/lib/i18n";

export type Section = "list" | "browse" | "comingSoon" | "watchNights" | "stats";

/** The main sections in nav order, which is also the order page transitions travel in. */
export const SECTIONS: { key: Section; href: string; icon: ReactNode }[] = [
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
      strokeWidth={2.25}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-6"
    >
      {children}
    </svg>
  );
}

/** Search and Settings, as round buttons in the header on every screen size. */
function IconLinks({
  current,
  t,
}: {
  current: (href: string) => "page" | undefined;
  t: ReturnType<typeof getMessages>["common"]["nav"];
}) {
  return (
    <>
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
          title={t[key]}
          className="grid size-11 place-items-center rounded-full border-[3px] border-outline bg-surface text-ink shadow-[3px_3px_0_var(--outline)] transition duration-150 ease-(--ease-spring) hover:-translate-y-0.5 hover:-rotate-6 aria-[current=page]:bg-accent aria-[current=page]:text-on-accent"
        >
          <Icon>{icon}</Icon>
        </Link>
      ))}
    </>
  );
}

function isCurrent(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

const reducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * The grape pill behind the current section. It travels to the new section with a stretch (a cartoon
 * smear), and the tabs it passes on the way jiggle. Until it has measured, the current link paints its own
 * pill (`ready` false), so nothing jumps before the script runs.
 */
function usePill(listRef: RefObject<HTMLUListElement | null>, pillRef: RefObject<HTMLLIElement | null>, index: number) {
  const [ready, setReady] = useState(false);
  const previous = useRef(index);

  useLayoutEffect(() => {
    const list = listRef.current;
    const pill = pillRef.current;
    if (!list || !pill) return;
    const links = [...list.querySelectorAll<HTMLElement>("[data-section-link]")];

    function place(animate: boolean) {
      if (!pill) return;
      const link = links[index];
      if (!animate || reducedMotion()) pill.style.transitionDuration = "0s";
      if (!link) {
        pill.style.opacity = "0";
        return;
      }
      pill.style.opacity = "1";
      pill.style.left = `${link.offsetLeft}px`;
      pill.style.top = `${link.offsetTop}px`;
      pill.style.width = `${link.offsetWidth}px`;
      pill.style.height = `${link.offsetHeight}px`;
    }

    const from = previous.current;
    previous.current = index;
    const moved = from !== index && from >= 0 && index >= 0;
    if (moved && !reducedMotion()) {
      const distance = Math.abs(index - from);
      pill.style.transitionDuration = `${360 + 80 * (distance - 1)}ms`;
      place(true);
      pill.animate(
        [
          { transform: "none" },
          { transform: "scaleX(1.25) scaleY(.85)", offset: 0.4 },
          { transform: "scaleX(.96) scaleY(1.05)", offset: 0.7 },
          { transform: "none" },
        ],
        { duration: 380 },
      );
      const step = index > from ? 1 : -1;
      for (let k = from + step, j = 0; k !== index; k += step, j++) {
        links[k]?.animate(
          [{ transform: "none" }, { transform: "translateY(-6px) rotate(-6deg) scale(1.12)", offset: 0.4 }, { transform: "none" }],
          { duration: 300, delay: 50 + 65 * j, easing: "cubic-bezier(.3,1.6,.5,1)" },
        );
      }
    } else {
      place(false);
    }
    setReady(true);

    // Fonts and resizes change the links' widths: follow without animating.
    let first = true;
    const observer = new ResizeObserver(() => {
      // The first call reports the size it already has.
      if (first) first = false;
      else place(false);
    });
    observer.observe(list);
    return () => observer.disconnect();
  }, [index, listRef, pillRef]);

  return ready;
}

/**
 * The signed-in navigation. Wide screens get the sections as a pill bar in the header (short names until
 * there's room for the full ones); phones get them in a tab bar along the bottom. Search and Settings are
 * round buttons in the header on both. Section links carry the transition types for the page flight.
 */
export function AppNav({ newAlerts, language }: { newAlerts: number; language: string }) {
  const pathname = usePathname();
  const t = getMessages(language).common.nav;
  const current = (href: string) => (isCurrent(pathname, href) ? "page" : undefined);
  const index = SECTIONS.findIndex(({ href }) => isCurrent(pathname, href));
  const barList = useRef<HTMLUListElement>(null);
  const barPill = useRef<HTMLLIElement>(null);
  const tabList = useRef<HTMLUListElement>(null);
  const tabPill = useRef<HTMLLIElement>(null);
  const barReady = usePill(barList, barPill, index);
  const tabReady = usePill(tabList, tabPill, index);

  const alertDot = (className: string) =>
    newAlerts > 0 && (
      <>
        <span aria-hidden className={`absolute size-3 rounded-full border-2 border-outline bg-accent ${className}`} />
        <span className="sr-only"> ({t.newAlerts(newAlerts)})</span>
      </>
    );
  const pill =
    "pointer-events-none absolute rounded-full border-[3px] border-outline bg-accent shadow-[2px_2px_0_var(--outline)] transition-[left,top,width,height] duration-[380ms] ease-[cubic-bezier(.3,1.5,.5,1)]";
  // Before the pill has measured, the current link paints its own.
  const ownPill = (ready: boolean, i: number) =>
    !ready && i === index ? { background: "var(--accent)", boxShadow: "inset 0 0 0 3px var(--outline)" } : undefined;

  return (
    <>
      <nav aria-label={t.label} className="hidden items-center gap-3 md:flex">
        <ul
          ref={barList}
          className="relative flex items-center rounded-full border-[3px] border-outline bg-surface p-1 shadow-[3px_3px_0_var(--outline)]"
        >
          <li ref={barPill} aria-hidden className={pill} style={{ opacity: 0 }} />
          {SECTIONS.map(({ key, href }, i) => (
            <li key={key}>
              <Link
                href={href}
                data-section-link
                aria-current={current(href)}
                transitionTypes={flightTypes(index, i)}
                style={ownPill(barReady, i)}
                className="relative z-[1] block rounded-full px-3 py-1.5 text-[15px] font-bold text-ink transition-colors duration-200 hover:text-accent aria-[current=page]:text-on-accent xl:px-4 xl:text-base"
              >
                <span className="xl:hidden">{t.short[key]}</span>
                <span className="hidden xl:inline">{t[key]}</span>
                {key === "comingSoon" && alertDot("-right-0.5 -top-0.5")}
              </Link>
            </li>
          ))}
        </ul>
        <IconLinks current={current} t={t} />
      </nav>

      <div className="flex items-center gap-2 md:hidden">
        <IconLinks current={current} t={t} />
      </div>

      <nav
        data-tab-bar
        aria-label={t.label}
        style={{ viewTransitionName: "tab-bar" }}
        className="fixed inset-x-0 bottom-0 z-20 border-t-[3px] border-outline bg-surface pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        <ul ref={tabList} className="relative mx-auto grid max-w-md grid-cols-5 px-1.5 py-1.5">
          <li ref={tabPill} aria-hidden className={pill} style={{ opacity: 0 }} />
          {SECTIONS.map(({ key, href, icon }, i) => (
            <li key={key}>
              <Link
                href={href}
                data-section-link
                aria-current={current(href)}
                transitionTypes={flightTypes(index, i)}
                style={ownPill(tabReady, i)}
                className="relative z-[1] flex flex-col items-center gap-0.5 rounded-full px-1 pb-1 pt-1.5 text-[11px] font-bold text-ink aria-[current=page]:text-on-accent"
              >
                <span className="relative">
                  <Icon>{icon}</Icon>
                  {key === "comingSoon" && alertDot("-right-1 -top-0.5")}
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
