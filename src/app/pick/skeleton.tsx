import { SkelButton, SkelChip, SkelField, SkelPageTitle, SkelParagraph, SkelPoster, Skeleton, SkelText } from "@/components/skeleton";
import { QUICK_MINUTES } from "@/lib/pick-rules";

const NBSP = " ";

/** Pick while it loads: the heading and the time card (the pick itself needs a time, so it has its own). */
export function PickSkeleton() {
  return (
    <Skeleton className="grid gap-8">
      <div className="grid gap-3">
        <SkelPageTitle width="15rem" />
        <SkelParagraph lines={3} smLines={2} className="max-w-[60ch] text-lg font-medium" />
      </div>
      <div aria-hidden className="card grid gap-4">
        <SkelText bar="ink" className="display-ink text-2xl" width="12rem" />
        <div className="flex flex-wrap items-center gap-2">
          {QUICK_MINUTES.map((m) => (
            <SkelChip key={m} width="5rem" />
          ))}
          <SkelChip width="13rem" />
        </div>
        <div className="flex max-w-xs items-end gap-2.5">
          <span className="grid flex-1 gap-1.5 text-sm font-bold">
            <SkelText width="40%" />
            <SkelField className="text-base font-medium" />
          </span>
          <SkelButton quiet width="4rem" className="py-2" />
        </div>
      </div>
    </Skeleton>
  );
}

/** The pick's spotlight card while it's chosen: poster, title, tags, reason and the actions. */
export function PickCardSkeleton() {
  return (
    <div
      aria-busy
      style={{ rotate: "-0.75deg" }}
      className="spotlight grid grid-cols-[7.5rem_minmax(0,1fr)] gap-x-4 gap-y-5 p-4 sm:grid-cols-[220px_minmax(0,1fr)] sm:grid-rows-[auto_1fr] sm:gap-x-7 sm:p-6"
    >
      <span aria-hidden className="self-start sm:row-span-2">
        <SkelPoster size="fluid" className="-rotate-2 shadow-[6px_6px_0_var(--outline)]" />
      </span>
      <div aria-hidden className="grid min-w-0 content-start gap-3">
        <SkelText bar="pop" className="display-pop text-[clamp(1.8rem,4vw,2.75rem)]" width="85%" />
        <span className="flex flex-wrap gap-1.5">
          {["3rem", "3.5rem", "6rem"].map((width) => (
            <span key={width} className="paper rounded-full border-[2.5px] border-outline px-2.5 text-sm font-bold" style={{ width }}>
              {NBSP}
            </span>
          ))}
        </span>
        <SkelText className="font-semibold" width="70%" />
      </div>
      <div aria-hidden className="col-span-2 flex flex-wrap items-center gap-2.5 sm:col-span-1 sm:col-start-2">
        <SkelButton width="9rem" icon="size-4" />
        <SkelButton quiet width="6rem" />
        <SkelButton quiet width="7.5rem" icon="size-5" />
      </div>
    </div>
  );
}
