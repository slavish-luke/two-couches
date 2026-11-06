import { Skeleton, SkelPageTitle, SkelText } from "@/components/skeleton";

/** The watch room while it loads: back link, heading and the night's line, then the player panel and the people panel. */
export function WatchRoomSkeleton() {
  return (
    <Skeleton wide className="grid gap-6">
      <div className="grid gap-3">
        <SkelText className="font-bold" width="8rem" />
        <SkelPageTitle width="14rem" />
        <SkelText className="font-medium" width="16rem" />
      </div>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
        <span aria-hidden className="card block min-h-72 sm:aspect-video" />
        <span aria-hidden className="card block h-44" />
      </div>
    </Skeleton>
  );
}
