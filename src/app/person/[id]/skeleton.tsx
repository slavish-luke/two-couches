import { SkelParagraph, SkelPoster, Skeleton, SkelText, SkelTitleCard } from "@/components/skeleton";

/** A person's page while TMDB answers: their photo and name, the biography, then their films and series. */
export function PersonSkeleton() {
  return (
    <Skeleton className="grid gap-12">
      <div className="grid gap-x-9 gap-y-6 sm:grid-cols-[auto_minmax(0,1fr)]">
        <div className="justify-self-center sm:justify-self-start">
          <SkelPoster size="lg" className="-rotate-2 shadow-[7px_7px_0_var(--outline)]" />
        </div>
        <div className="grid min-w-0 content-start gap-4">
          <div className="grid gap-2">
            <SkelText bar="lettering" className="display text-[clamp(2.4rem,5vw,3.6rem)]" width="75%" />
            <SkelText className="font-bold" width="55%" />
          </div>
          <SkelParagraph lines={6} className="max-w-[62ch] text-[1.05rem] font-medium leading-relaxed" />
          <SkelText className="text-sm font-bold" width="6rem" />
        </div>
      </div>
      <PersonTitlesSkeleton />
    </Skeleton>
  );
}

/** The films-and-series grid, as the page lays it out: heading, note, then cards (two lines under each title). */
export function PersonTitlesSkeleton() {
  return (
    <section aria-busy className="grid gap-3">
      <SkelText bar="lettering" className="display text-[2rem]" width="15rem" />
      <SkelText className="font-medium" width="70%" />
      <ul className="grid grid-cols-2 gap-x-5 gap-y-8 pt-3 sm:grid-cols-3 md:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => (
          <SkelTitleCard key={i} details={2} />
        ))}
      </ul>
    </section>
  );
}
