import { Skeleton, SkelPageTitle, SkelText, SkelTitleCard } from "@/components/skeleton";

/** The share page while it loads: the heading and what was shared, then the results. */
export function ShareSkeleton() {
  return (
    <Skeleton className="grid gap-6">
      <div className="grid gap-3">
        <SkelPageTitle width="14rem" twoLinesOnPhones />
        <span className="grid max-w-[65ch] gap-0.5 font-medium">
          <SkelText className="text-sm font-bold" width="12rem" />
          <SkelText width="70%" />
        </span>
      </div>
      <ShareResultsSkeleton />
    </Skeleton>
  );
}

/** "Is it one of these?" and a row of poster cards, as the results are laid out. */
export function ShareResultsSkeleton() {
  return (
    <div aria-busy className="grid gap-2">
      <SkelText bar="lettering" className="display text-[2rem]" width="13rem" />
      <ul className="grid grid-cols-2 gap-x-5 gap-y-8 pt-3 sm:grid-cols-3 md:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <SkelTitleCard key={i} />
        ))}
      </ul>
    </div>
  );
}
