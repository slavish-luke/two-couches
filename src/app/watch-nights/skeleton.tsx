import type { ReactNode } from "react";
import { SkelButton, SkelChip, SkelField, Skeleton, SkelPageTitle, SkelParagraph, SkelText } from "@/components/skeleton";
import { NightCardSkeleton } from "./night-skeleton";

/**
 * Watch nights while they load: the heading, intro and "Plan a watch night", the Upcoming head with a day
 * and one night card, the closed calendar panel, and two past nights.
 */
export function WatchNightsSkeleton() {
  return (
    <Skeleton className="grid gap-10">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div className="grid w-full max-w-[34rem] gap-3">
          <SkelPageTitle width="15rem" />
          <SkelParagraph className="font-medium" lines={2} />
        </div>
        <SkelButton icon="size-5" width="13rem" />
      </div>

      <section className="grid gap-5">
        <SkelText bar="lettering" className="display text-[2rem]" width="9rem" />
        <div className="grid gap-3">
          <SkelText bar="ink" className="display-ink text-xl" width="10rem" />
          <ul className="grid gap-5">
            <NightCardSkeleton listing />
          </ul>
        </div>
      </section>

      <CalendarPanelSkeleton />

      <section className="grid gap-4">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
          <SkelText bar="lettering" className="display text-[2rem]" width="6rem" />
          <SkelText className="font-bold" width="8.5rem" />
        </div>
        <ul className="grid gap-3">
          {[0, 1].map((i) => (
            <NightCardSkeleton key={i} listing actions={false} className="paper rounded-panel border-[3px] border-outline/70 p-4" />
          ))}
        </ul>
      </section>
    </Skeleton>
  );
}

/** `<CalendarSubscribe>` closed: its summary row. */
function CalendarPanelSkeleton() {
  return (
    <div className="card w-full p-0">
      <div className="flex items-center justify-between gap-3 px-5 py-4">
        <span className="flex min-w-0 flex-1 items-center gap-3">
          <span className="size-6 shrink-0" />
          <span className="grid min-w-0 flex-1 display-ink text-xl"><SkelText bar="ink" width="85%" /><SkelText bar="ink" className="sm:hidden" width="35%" /></span>
        </span>
        <span className="size-8 shrink-0 rounded-full border-[2.5px] border-outline bg-pop" />
      </div>
    </div>
  );
}

/**
 * The plan / change form while it loads: the back link and heading, then `<NightForm>`'s sections.
 * Shared by /watch-nights/new and /watch-nights/[id].
 */
export function NightFormSkeleton({ editing = false }: { editing?: boolean }) {
  return (
    <Skeleton className="grid gap-6">
      <div className="grid gap-3">
        <SkelText className="font-bold" width="9rem" />
        <SkelPageTitle width="16rem" twoLinesOnPhones />
      </div>
      <div className="grid gap-4">
        <div className="card grid gap-6">
          <Labelled>
            <SkelField select />
          </Labelled>

          <div className="grid gap-4">
            {/* One time or a few (new nights only). */}
            {!editing && (
              <div className="flex flex-wrap gap-2">
                <SkelChip width="6.5rem" />
                <SkelChip width="11rem" />
              </div>
            )}
            <div className="flex flex-wrap items-end gap-3">
              <Labelled>
                <SkelField className="w-[10.5rem]" />
              </Labelled>
              <Labelled>
                <SkelField className="w-36" />
              </Labelled>
              <SkelText className="pb-2.5 text-sm" width="11rem" />
            </div>
            {/* The hour grid: a day's 24 slots, four across on phones and six from sm. */}
            <div className="grid gap-3">
              <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6 sm:gap-2">
                {Array.from({ length: 24 }, (_, i) => (
                  <span
                    key={i}
                    className={`grid gap-0.5 rounded-control border-[2.5px] border-outline px-1.5 pb-1.5 pt-1 leading-tight sm:px-2 ${i >= 17 && i <= 21 ? "bg-accent-soft" : "bg-surface"}`}
                  >
                    <SkelText className="text-sm font-bold sm:text-[15px]" width="75%" />
                    <SkelText className="text-[11px] font-semibold sm:text-xs" width="60%" />
                  </span>
                ))}
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-sm font-semibold">
                {["2.5rem", "2.5rem", "16rem", "8rem", "14rem", "10rem", "3rem"].map((width, i) => (
                  <SkelText key={i} width={width} />
                ))}
              </div>
            </div>
            <div className="paper grid gap-2 rounded-control border-[3px] border-outline p-3">
              <div className="grid gap-1.5">
                {["bg-me", "bg-partner"].map((fill) => (
                  <div key={fill} className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                    <span className={`w-14 rounded-full border-[2.5px] border-outline px-2.5 text-sm font-bold ${fill}`}>{" "}</span>
                    <SkelText className="font-semibold" width="9rem" />
                  </div>
                ))}
              </div>
              <SkelParagraph className="font-semibold" lines={2} smLines={1} />
            </div>
          </div>

          <div className="grid gap-3">
            <SkelText className="mb-2 text-[15px] font-bold" width="9rem" />
            <div className="flex flex-wrap gap-2">
              {["6rem", "6.5rem", "6rem", "5rem"].map((width, i) => (
                <SkelChip key={i} width={width} />
              ))}
            </div>
            {editing && (
              <>
                <SkelText className="text-sm" width="80%" />
                <Labelled>
                  <SkelField />
                </Labelled>
              </>
            )}
          </div>

          <Labelled>
            <SkelField lines={2} />
          </Labelled>

          <div className="grid justify-items-start gap-2.5 border-t-2 border-outline/15 pt-5">
            <SkelButton width="7rem" />
            <SkelText className="text-sm" width="60%" />
          </div>
        </div>
        {editing && <SkelButton quiet width="9rem" className="justify-self-start" />}
      </div>
    </Skeleton>
  );
}

/** A form label over its field, like NightForm's. */
function Labelled({ children }: { children: ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <SkelText className="text-[15px] font-bold" width="7rem" />
      {children}
    </div>
  );
}
