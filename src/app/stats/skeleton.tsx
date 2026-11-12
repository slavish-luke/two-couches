import { NBSP, SkelButton, SkelChip, Skeleton, SkelPageTitle, SkelPoster, SkelText } from "@/components/skeleton";

/** Bar heights for the month chart's blank columns (percent): any shape, so long as it reads as a chart. */
const MONTHS = [35, 55, 30, 70, 45, 85, 40, 60, 25, 75, 50, 40];
const GENRES = [100, 80, 62, 45, 30];

/**
 * Stats while it loads, sized for a year with something watched: the heading, year chips, intro and "Save as
 * an image", the four tiles in the spotlight, the month chart, top genres, ratings (averages and two
 * favourites), who added what, then "Just the two of you" (four cards and the stickers). A year with nothing
 * watched shows one shorter card instead of the charts.
 */
export function StatsSkeleton() {
  return (
    <Skeleton className="grid gap-9">
      <div className="grid gap-4">
        <SkelPageTitle width="8rem" />
        <div className="flex flex-wrap gap-2">
          <SkelChip width="4.25rem" />
          <SkelChip width="5.5rem" />
        </div>
        <SkelText className="font-medium" width="70%" />
        <SkelButton quiet icon="size-4" width="14rem" className="w-fit text-sm" />
      </div>

      <div className="spotlight grid grid-cols-2 gap-4 p-5 sm:grid-cols-4 sm:p-6">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="paper grid min-w-0 content-start justify-items-center gap-1 rounded-control border-[3px] border-outline px-3 pb-3 pt-2 shadow-[4px_4px_0_var(--outline)] odd:-rotate-2 even:rotate-1"
          >
            <SkelText className="text-sm font-bold leading-snug" width="80%" />
            <SkelText bar="ink" className="display-ink text-[clamp(2.8rem,6vw,3.8rem)] leading-none" width="2.2rem" />
          </div>
        ))}
      </div>

      <div className="card grid gap-4">
        <SkelText bar="ink" className="display-ink text-2xl" width="45%" />
        <div className="grid h-40 grid-cols-12 items-end gap-1 border-b-[3px] border-outline sm:gap-2">
          {MONTHS.map((height, i) => (
            <span key={i} className="flex h-full flex-col items-center justify-end">
              <span
                style={{ height: `${height}%` }}
                className="-mb-[3px] w-full max-w-9 rounded-t-control border-[3px] border-outline bg-accent-soft motion-safe:animate-pulse"
              />
            </span>
          ))}
        </div>
        <div className="-mt-2 grid grid-cols-12 gap-1 text-sm font-bold sm:gap-2">
          {MONTHS.map((_, i) => (
            <SkelText key={i} className="mx-auto" width="0.6rem" />
          ))}
        </div>
      </div>

      <div className="card grid gap-4">
        <SkelText bar="ink" className="display-ink text-2xl" width="40%" />
        <div className="grid gap-3">
          {GENRES.map((width, i) => (
            <div key={i} className="grid grid-cols-[minmax(5.5rem,9rem)_1fr] items-center gap-3">
              <SkelText className="font-semibold" width="80%" />
              <span className="flex items-center gap-2.5">
                <span
                  style={{ width: `${width}%` }}
                  className="h-7 min-w-7 max-w-[calc(100%-2.5rem)] rounded-full border-[3px] border-outline bg-accent-soft shadow-[var(--lift-sm)_var(--lift-sm)_0_var(--outline)]"
                />
                <SkelText bar="ink" className="display-ink text-xl" width="1rem" />
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="card grid gap-6">
        <SkelText bar="ink" className="display-ink text-2xl" width="35%" />
        <div className="grid gap-2">
          <SkelText className="font-bold" width="30%" />
          <div className="flex flex-wrap gap-3">
            {["bg-me", "bg-partner"].map((fill) => (
              <div key={fill} className="flex items-center gap-3 rounded-control border-[2.5px] border-outline px-3 py-2">
                <span className={`w-14 rounded-full border-[2.5px] border-outline px-2.5 text-sm font-bold ${fill}`}>{" "}</span>
                <span className="flex items-center gap-1.5">
                  <SkelText bar="ink" className="display-ink text-3xl" width="2.5rem" />
                  <span className="size-6" />
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className="grid gap-2.5">
          <SkelText className="font-bold" width="40%" />
          <div className="grid gap-3 sm:grid-cols-2">
            {[0, 1].map((i) => (
              <div key={i} className="flex items-center gap-3.5 rounded-control border-[2.5px] border-outline bg-surface p-2.5">
                <SkelPoster size="sm" />
                <span className="grid min-w-0 flex-1 gap-1.5">
                  <SkelText className="text-lg font-bold leading-snug" width="75%" />
                  <span className="grid gap-1">
                    {["bg-me", "bg-partner"].map((fill) => (
                      <span key={fill} className="flex items-center gap-x-2">
                        <span className={`w-12 rounded-full border-[2.5px] border-outline px-2.5 text-sm font-bold ${fill}`}>{" "}</span>
                        <SkelText width="5rem" />
                      </span>
                    ))}
                  </span>
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card grid gap-4">
        <div className="grid gap-1">
          <SkelText bar="ink" className="display-ink text-2xl" width="45%" />
          <SkelText width="65%" />
        </div>
        <div className="flex h-10 overflow-hidden rounded-full border-[3px] border-outline shadow-[var(--lift-sm)_var(--lift-sm)_0_var(--outline)]">
          <span className="w-3/5 bg-me" />
          <span className="w-2/5 border-l-[3px] border-outline bg-partner" />
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-1.5 font-semibold">
          <SkelText width="5rem" />
          <SkelText width="6rem" />
        </div>
      </div>

      {/* Just the two of you: taste match, weeks in a row, milestones, guesses, then the stickers. */}
      <div className="grid gap-5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <SkelText bar="lettering" className="display text-[2rem]" width="16rem" />
          <span className="strand w-16">{NBSP}</span>
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="card grid content-start gap-3">
            <SkelText bar="ink" className="display-ink text-2xl" width="55%" />
            <SkelText bar="ink" className="display-ink text-[clamp(3rem,7vw,4rem)] leading-none" width="6rem" />
            <span className="h-6 rounded-full border-[3px] border-outline bg-accent-soft" />
            <span className="grid text-sm">
              <SkelText width="95%" />
              <SkelText width="70%" />
            </span>
            <SkelText className="font-bold" width="9rem" />
          </div>
          <div className="card grid content-start gap-3">
            <SkelText bar="ink" className="display-ink text-2xl" width="60%" />
            <span className="flex items-center gap-3">
              <span className="size-14 shrink-0 rounded-full border-[3px] border-outline bg-accent-soft" />
              <SkelText bar="ink" className="display-ink text-[clamp(2.2rem,5vw,2.8rem)] leading-none" width="7rem" />
            </span>
            <SkelText className="font-bold" width="6rem" />
            <span className="grid text-sm">
              <SkelText width="90%" />
            </span>
          </div>
          <div className="card grid content-start gap-3">
            <SkelText bar="ink" className="display-ink text-2xl" width="50%" />
            <span className="grid gap-2 font-semibold">
              <SkelText width="85%" />
              <SkelText width="65%" />
              <SkelText width="75%" />
            </span>
            <SkelText className="text-sm" width="80%" />
          </div>
          <div className="card grid content-start gap-3">
            <SkelText bar="ink" className="display-ink text-2xl" width="65%" />
            <span className="grid gap-2">
              {["bg-me", "bg-partner"].map((fill) => (
                <span key={fill} className="flex items-center gap-x-2.5">
                  <span className={`w-14 rounded-full border-[2.5px] border-outline px-2.5 text-sm font-bold ${fill}`}>{NBSP}</span>
                  <SkelText className="font-semibold" width="10rem" />
                </span>
              ))}
            </span>
          </div>
        </div>
        <div className="card grid gap-4">
          <div className="grid gap-1">
            <SkelText bar="ink" className="display-ink text-2xl" width="35%" />
            <SkelText width="60%" />
          </div>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(7.5rem,1fr))] gap-x-3 gap-y-5">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <span key={i} className="grid content-start justify-items-center gap-1.5">
                <span className="size-22 rounded-full border-[3px] border-outline bg-accent-soft motion-safe:animate-pulse" />
                <SkelText className="font-bold leading-tight" width="70%" />
                <SkelText className="text-sm leading-snug" width="85%" />
              </span>
            ))}
          </div>
        </div>
      </div>
    </Skeleton>
  );
}
