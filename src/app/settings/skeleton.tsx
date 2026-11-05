import type { ReactNode } from "react";
import { Couch } from "@/components/couch";
import {
  SkelButton,
  SkelChip,
  SkelField,
  Skeleton,
  SkelPageTitle,
  SkelParagraph,
  SkelPoster,
  SkelText,
} from "@/components/skeleton";

/** The services panel shows this many tiles until "Show all" (SettingsForm's COLLAPSED_COUNT). */
const SERVICE_TILES = 18;

/**
 * Settings while it loads, section by section for a paired profile: the heading, the profile and services
 * panels, Travelling, the advisor, then "On this device" (appearance, notifications, install, data saver)
 * and sign out.
 */
export function SettingsSkeleton() {
  return (
    <Skeleton className="grid gap-7">
      <div className="grid gap-3">
        <SkelPageTitle width="10rem" />
        <SkelParagraph className="font-medium" lines={2} smLines={1} />
      </div>

      <div className="grid gap-7">
        <div className="card grid gap-4">
          <PanelHead width="30%" />
          <Labelled>
            <SkelField />
          </Labelled>
          <Labelled>
            <SkelField select />
          </Labelled>
          <div className="grid gap-4 sm:grid-cols-2">
            <Labelled>
              <SkelField select />
            </Labelled>
            <Labelled>
              <SkelField select />
            </Labelled>
          </div>
        </div>

        <div className="card grid gap-4">
          <div className="grid gap-4">
            <PanelHead width="75%" phoneLines={2} />
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              {Array.from({ length: SERVICE_TILES }, (_, i) => (
                <span
                  key={i}
                  className="flex min-w-0 items-center gap-2 rounded-control border-[2.5px] border-outline bg-surface p-1.5 font-semibold leading-tight sm:pr-2"
                >
                  <span className="size-7 shrink-0 rounded-lg border-2 border-outline bg-accent-soft sm:size-8" />
                  {/* Long names take two lines in the phone's two columns. */}
                  <span className="grid min-w-0 flex-1 text-sm sm:text-[15px]">
                    <SkelText width="85%" />
                    <SkelText className="sm:hidden" width="50%" />
                  </span>
                </span>
              ))}
            </div>
            <SkelButton quiet width="8rem" className="justify-self-start text-sm" />
          </div>
          <div className="flex flex-wrap items-center gap-3 border-t-2 border-outline/15 pt-4">
            <SkelButton width="6rem" />
          </div>
        </div>
      </div>

      <div className="card grid gap-4">
        <div className="grid gap-1.5">
          <PanelHead width="35%" />
          <SkelParagraph lines={7} smLines={4} />
        </div>
        <div className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Labelled>
              <SkelField select />
            </Labelled>
            <Labelled>
              <SkelField />
            </Labelled>
          </div>
          <SkelButton width="7rem" className="justify-self-start" />
        </div>
      </div>

      <AdvisorSkeleton />

      <div className="mt-4 grid gap-5">
        <div className="grid gap-2">
          <SkelText bar="lettering" className="display text-[2rem]" width="12rem" />
          <SkelText className="font-medium" width="70%" />
        </div>
        <Panel>
          <div className="grid gap-5">
            <SkelParagraph lines={4} smLines={2} />
            <div className="grid gap-2.5">
              <SkelText className="font-bold" width="5rem" />
              <div className="grid gap-3 sm:grid-cols-2">
                <span className="grid gap-2 rounded-panel border-[3px] border-outline bg-surface p-2 shadow-[4px_4px_0_var(--outline)]">
                  <span className="flex h-24 items-end justify-center gap-1 rounded-control border-[3px] border-outline bg-pop pb-2">
                    <Couch who="me" size={50} />
                    <Couch who="partner" size={50} />
                  </span>
                  <span className="grid px-1 pb-0.5 leading-tight">
                    <SkelText className="font-bold" width="55%" />
                    <SkelParagraph className="text-sm" lines={2} smLines={1} />
                  </span>
                </span>
              </div>
            </div>
            <div className="grid gap-2.5">
              <SkelText className="font-bold" width="5rem" />
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {Array.from({ length: 8 }, (_, i) => (
                  <span key={i} className="grid gap-2 rounded-panel border-[3px] border-outline bg-surface p-2">
                    <span className="h-16 rounded-control border-[3px] border-outline bg-accent-soft" />
                    <SkelText className="px-1 pb-0.5 text-sm font-bold leading-tight" width="70%" />
                  </span>
                ))}
              </div>
            </div>
          </div>
        </Panel>
        <Panel intro={[3, 2]}>
          <div className="grid gap-3">
            <SkelText className="font-medium" width="40%" />
            <div className="flex flex-wrap gap-2">
              <SkelButton width="12rem" />
            </div>
          </div>
        </Panel>
        <div className="grid gap-5 sm:grid-cols-2">
          <Panel intro={[3, 3]}>
            <SkelButton width="6rem" className="justify-self-start" />
          </Panel>
          <Panel intro={[4, 4]}>
            <div className="flex flex-wrap gap-2">
              <SkelChip width="4.5rem" className="px-4" />
              <SkelChip width="4rem" className="px-4" />
              <SkelChip width="4rem" className="px-4" />
            </div>
          </Panel>
        </div>
      </div>

      <div className="mt-2 flex justify-end">
        <SkelButton quiet width="7rem" />
      </div>
    </Skeleton>
  );
}

/**
 * The subscription advisor while it works: its heading and intro, five suggestions (logo, name, counts,
 * posters) and the note under them.
 */
export function AdvisorSkeleton() {
  return (
    <div aria-busy className="card grid gap-4">
      <div className="grid gap-1.5">
        <PanelHead width="80%" phoneLines={2} />
        <SkelParagraph lines={4} smLines={2} />
      </div>
      <ul className="grid gap-3">
        {[0, 1, 2, 3, 4].map((i) => (
          <li
            key={i}
            className="tilt-row paper grid gap-3 rounded-control border-[3px] border-outline p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
          >
            <div className="flex min-w-0 items-center gap-3">
              <span className="size-12 shrink-0 rounded-control border-[2.5px] border-outline bg-accent-soft" />
              <div className="grid min-w-0 flex-1 gap-1">
                <SkelText className="text-lg font-bold leading-snug" width="60%" />
                <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
                  <SkelText className="text-sm font-semibold" width="9rem" />
                  <SkelText bar="ink" className="display-ink text-lg" width="5rem" />
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {[0, 1, 2].map((j) => (
                <SkelPoster key={j} size="xs" />
              ))}
            </div>
          </li>
        ))}
      </ul>
      <SkelText className="text-sm" width="70%" />
      <SkelText className="text-sm" width="50%" />
    </div>
  );
}

/** A panel's `display-ink` heading; `phoneLines` 2 for the long ones that wrap on phones. */
function PanelHead({ width, phoneLines = 1 }: { width: string; phoneLines?: 1 | 2 }) {
  return (
    <span className="grid display-ink text-2xl">
      <SkelText bar="ink" width={width} />
      {phoneLines === 2 && <SkelText bar="ink" className="sm:hidden" width="40%" />}
    </span>
  );
}

/** A label over its field, like the settings forms'. */
function Labelled({ children }: { children: ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <SkelText className="font-semibold" width="8rem" />
      {children}
    </div>
  );
}

/** Settings' `Panel`: a paper card with a heading, an optional intro (lines on phones, from sm), then its content. */
function Panel({ intro, children }: { intro?: [number, number]; children: ReactNode }) {
  return (
    <div className="card grid content-start gap-4">
      <div className="grid gap-1.5">
        <PanelHead width="45%" />
        {intro && <SkelParagraph lines={intro[0]} smLines={intro[1]} />}
      </div>
      {children}
    </div>
  );
}
