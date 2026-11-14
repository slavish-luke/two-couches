import {
  SkelButton,
  SkelChip,
  Skeleton,
  SkelSelect,
  SkelTab,
  SkelText,
  SkelTitleCard,
} from "@/components/skeleton";

/**
 * Browse while it loads: the Films / Series tabs, then the catalogue (heading, service chips, the four
 * filters and the grid) with For you and the streaming rows in the rail beside it (first on phones).
 */
export function BrowseSkeleton() {
  return (
    <Skeleton wide className="grid gap-8">
      <div className="-mx-1 flex items-center gap-3 overflow-hidden px-1 pb-2 pt-1">
        {["9.5rem", "9rem"].map((width) => (
          <SkelTab key={width} width={width} className="shrink-0 px-5 pb-2 pt-3.5 text-[2rem] sm:text-[2.6rem]" />
        ))}
      </div>
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_24rem] lg:grid-rows-[auto_1fr] lg:gap-x-10 xl:grid-cols-[minmax(0,1fr)_27rem]">
        <div className="lg:col-start-2 lg:row-start-1">
          <ForYouSkeleton />
        </div>
        <section className="grid content-start gap-5 lg:col-start-1 lg:row-span-2 lg:row-start-1">
          <SkelText bar="lettering" className="display text-[clamp(2rem,4vw,2.8rem)]" width="15rem" />
          <div className="flex flex-wrap gap-2">
            <SkelChip width="14.5rem" />
            <SkelChip width="13rem" />
            <span className="mx-1 w-[3px] self-stretch rounded-full bg-outline/25" />
            <SkelChip logo width="7rem" />
            <SkelChip logo width="8.5rem" />
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:max-w-4xl">
            {[0, 1, 2, 3].map((i) => (
              <SkelSelect key={i} />
            ))}
          </div>
          <BrowseResultsSkeleton />
        </section>
        <div className="grid content-start gap-8 lg:col-start-2 lg:row-start-2">
          {[0, 1, 2].map((row) => (
            <div key={row} className="card grid gap-4 pb-6">
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                <SkelText bar="ink" className="display-ink text-2xl" width="11rem" />
              </div>
              <ul className="grid grid-cols-3 gap-x-3 gap-y-6 pt-1 sm:grid-cols-6 lg:grid-cols-3">
                {Array.from({ length: 6 }, (_, i) => (
                  <SkelTitleCard key={i} className="text-sm" />
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </Skeleton>
  );
}

/**
 * The catalogue below the filters: the scope line, the grid and the page buttons. Siblings in the
 * catalogue's grid, like BrowseResults' own.
 */
export function BrowseResultsSkeleton() {
  return (
    <>
      <span aria-hidden className="grid max-w-[65ch] text-sm font-medium">
        <SkelText width="95%" />
        <SkelText width="40%" />
      </span>
      <ul aria-busy className="grid grid-cols-2 gap-x-5 gap-y-8 pt-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
        {Array.from({ length: 10 }, (_, i) => (
          <SkelTitleCard key={i} />
        ))}
      </ul>
      <div aria-hidden className="mt-2 flex items-center justify-between gap-3">
        <span />
        <span className="w-20 rounded-full border-[2.5px] border-outline bg-surface px-3 py-0.5 text-sm font-bold">{" "}</span>
        <SkelButton width="7rem" icon="size-5" />
      </div>
    </>
  );
}

/** For you while suggestions load: the spotlight, its head and note, and six cards with their reasons. */
export function ForYouSkeleton() {
  return (
    <div aria-busy className="spotlight grid rotate-[-0.6deg] gap-5 p-5 pb-6">
      <div className="grid gap-1.5">
        <SkelText bar="pop" className="display-pop text-[2rem]" width="9rem" />
        <SkelText className="text-sm font-medium" width="85%" />
      </div>
      <ul className="grid grid-cols-3 gap-x-3 gap-y-6 pt-1 sm:grid-cols-6 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <SkelTitleCard
            key={i}
            className="text-sm"
            lastTitleLine="lg:hidden"
            details={
              <span className="grid w-full text-[13px] font-medium leading-snug">
                <SkelText width="90%" />
              </span>
            }
            extra={<SkelText className="text-[13px] font-semibold" width="75%" />}
          />
        ))}
      </ul>
    </div>
  );
}
