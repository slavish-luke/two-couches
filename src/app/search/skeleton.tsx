import { SkelButton, SkelField, Skeleton, SkelPageTitle, SkelTitleCard } from "@/components/skeleton";

/** Search while it loads: the heading and search box, then the results grid. */
export function SearchSkeleton() {
  return (
    <Skeleton className="grid gap-6">
      <SkelPageTitle width="9rem" />
      <div className="flex gap-2">
        <SkelField className="min-w-0 flex-1" />
        <SkelButton width="5.5rem" className="shrink-0 px-3 sm:px-4" />
      </div>
      <SearchResultsSkeleton />
    </Skeleton>
  );
}

/** The results grid: two posters across on phones, three from sm, four from md, as the results are. */
export function SearchResultsSkeleton() {
  return (
    <ul aria-busy className="grid grid-cols-2 gap-x-5 gap-y-8 pt-3 sm:grid-cols-3 md:grid-cols-4">
      {Array.from({ length: 8 }, (_, i) => (
        <SkelTitleCard key={i} />
      ))}
    </ul>
  );
}
