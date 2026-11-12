import { Skeleton, SkelPageTitle, SkelParagraph, SkelText } from "@/components/skeleton";

/**
 * "All our nights" while it loads: the back link, heading and intro, the summary card, then a month with
 * three nights hanging off the line (the page's own classes, block for block).
 */
export function AllNightsSkeleton() {
  return (
    <Skeleton className="grid gap-8">
      <div className="grid gap-3">
        <SkelText className="font-bold" width="9rem" />
        <SkelPageTitle width="15rem" />
        <SkelParagraph className="max-w-[34rem] font-medium" lines={2} smLines={1} />
      </div>

      <div className="card flex flex-wrap items-baseline gap-x-6 gap-y-2 py-4">
        <SkelText bar="ink" className="display-ink text-3xl" width="8rem" />
        <SkelText className="font-bold" width="11rem" />
      </div>

      <div className="grid gap-8">
        <section className="grid gap-4">
          <SkelText bar="lettering" className="display text-[1.75rem]" width="12rem" />
          <ol className="relative grid gap-4 pl-6 before:absolute before:-bottom-2 before:left-[5px] before:top-3 before:w-[7px] before:rounded-full before:border-2 before:border-outline before:bg-surface sm:pl-8 sm:before:left-[9px]">
            {[0, 1, 2].map((i) => (
              <li key={i} className="relative">
                <span className="absolute -left-6 top-5 size-[17px] rounded-full border-[3px] border-outline bg-surface sm:-left-8 sm:size-[25px]" />
                <div className="card grid grid-cols-[3.5rem_minmax(0,1fr)] gap-x-3 gap-y-2 p-3 sm:grid-cols-[4.5rem_minmax(0,1fr)] sm:gap-x-4 sm:p-4">
                  <span className="row-span-2 block aspect-[2/3] w-14 shrink-0 self-start rounded-poster border-[3px] border-outline bg-accent-soft sm:w-[4.5rem]" />
                  <div className="grid min-w-0 content-start gap-1">
                    <SkelText className="text-sm font-semibold" width="70%" />
                    <SkelText className="text-lg font-bold leading-snug sm:text-xl" width="60%" />
                  </div>
                  <div className="col-span-2 grid gap-2 sm:col-span-1 sm:col-start-2">
                    <SkelText className="text-sm" width="55%" />
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </Skeleton>
  );
}
