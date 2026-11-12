import { NBSP, SkelButton, SkelParagraph, SkelPoster, Skeleton, SkelText } from "@/components/skeleton";
import { CAST_CARD, CAST_ROW } from "./cast";
import { SCORE_TILE } from "./critic-scores";

/**
 * The title page while it loads: the poster (the deck's top card), the title column (with critic scores
 * when OMDb is set up: `scores`), where to watch and the cast.
 */
export function TitleSkeleton({ scores = false }: { scores?: boolean }) {
  return (
    <Skeleton className="grid gap-12">
      <div className="grid gap-x-9 gap-y-6 sm:grid-cols-[auto_minmax(0,1fr)]">
        <div className="justify-self-center sm:justify-self-start">
          <SkelPoster size="lg" className="-rotate-2 shadow-[7px_7px_0_var(--outline)]" />
        </div>
        <div className="grid min-w-0 content-start gap-4">
          <div className="grid gap-2">
            <SkelText bar="lettering" className="display text-[clamp(2.4rem,5vw,3.6rem)]" width="80%" />
            <SkelText className="font-bold" width="45%" />
            <span aria-hidden className="flex flex-wrap gap-1.5">
              {["4.5rem", "6rem", "5rem"].map((width) => (
                <span key={width} className="strand" style={{ width }}>
                  {NBSP}
                </span>
              ))}
            </span>
          </div>
          <SkelText className="text-lg font-semibold" width="50%" />
          <SkelParagraph lines={7} smLines={4} className="max-w-[62ch] text-[1.05rem] font-medium leading-relaxed" />
          <div className="flex flex-wrap gap-3 pt-1">
            <SkelButton width="11rem" />
            <SkelButton quiet width="7.5rem" icon="size-4" />
          </div>
          {scores && <ScoresSkeleton />}
        </div>
      </div>
      <WhereToWatchSkeleton />
      <CastSkeleton />
      <GuidanceSkeleton />
    </Skeleton>
  );
}

/** "Before you watch" (Sprint 19) while it loads: the heading, both age-rating tags and the DoesTheDogDie link. */
export function GuidanceSkeleton() {
  return (
    <section aria-busy className="card grid gap-5">
      <SkelText bar="ink" className="display-ink text-2xl" width="13rem" />
      <div className="grid gap-2">
        <SkelText className="font-bold" width="7rem" />
        <span aria-hidden className="flex flex-wrap gap-2">
          {(["bg-me", "bg-partner"] as const).map((fill) => (
            <span
              key={fill}
              className="flex overflow-hidden rounded-full border-[2.5px] border-outline bg-surface text-[15px] font-semibold leading-snug"
            >
              <span className={`w-24 border-r-[2.5px] border-outline px-2.5 ${fill}`}>{NBSP}</span>
              <span className="w-10 px-2.5">{NBSP}</span>
            </span>
          ))}
        </span>
      </div>
      <div className="grid justify-items-start gap-1.5 border-t-2 border-outline/15 pt-4">
        <SkelButton quiet width="16rem" icon="size-4" className="text-sm" />
        <SkelText className="text-sm" width="60%" />
      </div>
    </section>
  );
}

/** "Where to watch" while availability is checked: the heading, the verdict card and both people's columns. */
export function WhereToWatchSkeleton() {
  return (
    <section aria-busy className="grid gap-6">
      <SkelText bar="lettering" className="display text-[2rem]" width="13rem" />
      <div className="card grid gap-1">
        <SkelText bar="ink" className="display-ink text-2xl" width="55%" />
        <SkelText className="font-medium" width="85%" />
      </div>
      <div className="grid gap-6 sm:grid-cols-2 sm:gap-5">
        {(["bg-me", "bg-partner"] as const).map((fill) => (
          <div key={fill} aria-hidden className="card grid content-start gap-5">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
              <span className={`rounded-full border-[2.5px] border-outline px-3 py-0.5 text-lg font-bold ${fill}`} style={{ width: "7rem" }}>
                {NBSP}
              </span>
              <SkelText className="font-semibold" width="5rem" />
            </div>
            <div className="grid gap-2">
              <SkelText className="font-bold" width="40%" />
              <span className="flex flex-wrap gap-2">
                {["7rem", "6rem"].map((width) => (
                  <span
                    key={width}
                    className="flex items-center gap-2 rounded-full border-[2.5px] border-outline bg-surface py-1 pl-1 pr-3 text-sm font-semibold"
                    style={{ width }}
                  >
                    <span className="size-7 shrink-0 rounded-full border-2 border-outline bg-accent-soft" />
                    {NBSP}
                  </span>
                ))}
              </span>
            </div>
            <p className="border-t-2 border-outline/15 pt-3 text-sm">
              <SkelText width="70%" />
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

/** Critic scores (Sprint 23) while OMDb answers: three score tiles and the credit under them. */
export function ScoresSkeleton() {
  return (
    <div aria-busy className="grid justify-items-start gap-1.5">
      <span aria-hidden className="flex flex-wrap gap-2.5">
        {["9.5rem", "9rem", "8rem"].map((width) => (
          <span key={width} className={SCORE_TILE} style={{ width }}>
            <span className="display-ink text-xl leading-none">{NBSP}</span>
          </span>
        ))}
      </span>
      <SkelText className="text-sm" width="7.5rem" />
    </div>
  );
}

/** Cast and crew (Sprint 23) while TMDB answers: the heading, who made it, and a row of cast cards. */
export function CastSkeleton() {
  return (
    <section aria-busy className="grid gap-3">
      <SkelText bar="lettering" className="display text-[2rem]" width="14rem" />
      <SkelText className="text-lg" width="16rem" />
      <ul aria-hidden className={`${CAST_ROW} overflow-hidden`}>
        {Array.from({ length: 6 }, (_, i) => (
          <li key={i} data-title-card className={`${CAST_CARD} grid content-start justify-items-start gap-1`}>
            <span className="mb-1.5 block w-full">
              <SkelPoster size="fluid" className="shadow-[4px_4px_0_var(--outline)]" />
            </span>
            <SkelText className="font-bold leading-snug" width="85%" />
            <SkelText className="text-sm" width="70%" />
          </li>
        ))}
      </ul>
    </section>
  );
}
