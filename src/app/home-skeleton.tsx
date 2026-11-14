import { Couch } from "@/components/couch";
import { NBSP, SkelButton, SkelChip, SkelField, Skeleton, SkelPoster, SkelTab, SkelText } from "@/components/skeleton";
import { QuestionSkeleton } from "./together/question-skeleton";
import { NightCardSkeleton } from "./watch-nights/night-skeleton";

/**
 * Home while it loads, laid out like the page: the clocks panel (the couches already there), the next
 * night's spotlight, search and Pick in the aside, and the list beside it (under it on phones).
 */
export function HomeSkeleton() {
  return (
    <Skeleton wide className="grid grid-cols-[minmax(0,1fr)] gap-x-8 gap-y-8 lg:grid-cols-12">
      <div className="grid min-w-0 content-start gap-7 lg:col-span-5 xl:col-span-4">
        <div data-clocks className="card relative grid grid-cols-2 items-start gap-2 px-3 pb-4 pt-3 lg:-order-4">
          {(["me", "partner"] as const).map((who, i) => (
            <div
              key={who}
              className={`${i === 0 ? "col-start-1" : "col-start-2"} @container row-start-1 grid min-w-0 content-start justify-items-center gap-1.5`}
            >
              <Couch who={who} size={58} />
              <span className={`w-20 rounded-full border-[2.5px] border-outline px-2.5 text-sm font-bold ${i === 0 ? "bg-me" : "bg-partner"}`}>
                {" "}
              </span>
              <div data-clock className="grid w-full justify-items-center gap-1">
                <SkelText bar="ink" className="display-ink text-[clamp(2rem,26cqi,3.5rem)] leading-none" width="70%" />
                <SkelText className="text-sm font-semibold" width="45%" />
              </div>
              {/* Sprint 22: free time, busy hours or asleep (ClockState). */}
              <span className="inline-block w-[62%] rounded-full border-2 border-outline bg-surface px-2 text-[min(0.8125rem,8.4cqi)] font-bold leading-snug">
                {NBSP}
              </span>
            </div>
          ))}
          <span className="absolute -top-3.5 left-1/2 w-16 -translate-x-1/2 -rotate-6 rounded-full border-[3px] border-outline bg-accent px-2.5 pb-0.5 pt-1 text-sm leading-none shadow-[3px_3px_0_var(--outline)] sm:pb-1 sm:pt-1.5 sm:text-base">
            {" "}
          </span>
        </div>
        {/* Sprint 24: on phones the next night is a strip and the cards are chips in "Waiting for you" (TrayItem);
            from lg up the aside is as it was (the lg:order classes match the page's). */}
        <div className="lg:-order-1">
          <div className="spotlight flex -rotate-1 items-center gap-3 px-4 py-3 lg:hidden">
            <span className="grid min-w-0 flex-1 gap-0.5">
              <SkelText bar="pop" className="font-bold leading-snug" width="60%" />
              <SkelText className="text-sm font-semibold" width="75%" />
            </span>
          </div>
          <div className="spotlight hidden -rotate-1 gap-4 p-5 lg:grid">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              {/* As wide as the real head, so the link wraps under it like the real one. */}
              <SkelText bar="pop" className="display-pop text-[2rem]" width="85%" />
              <SkelText className="font-bold" width="8rem" />
            </div>
            <ul>
              <NightCardSkeleton className="" listing aside />
            </ul>
          </div>
        </div>
        <div className="flex flex-wrap items-start gap-2 lg:contents">
          <SkelText className="display basis-full text-xl lg:hidden" width="12rem" />
          <SkelChip width="11rem" className="lg:hidden" />
          <SkelChip width="9rem" className="lg:hidden" />
          <div className="hidden lg:block">
            <QuestionSkeleton />
          </div>
          <div className="hidden lg:-order-3 lg:block">
            <FreeTonightSkeleton />
          </div>
        </div>

        <div className="grid gap-4 lg:order-1">
          <div className="flex gap-2">
            <SkelField className="min-w-0 flex-1" />
            <SkelButton width="5.5rem" className="shrink-0 px-3 sm:px-4" />
          </div>
          <PickLinkSkeleton />
        </div>
      </div>

      <div className="min-w-0 lg:col-span-7 xl:col-span-8">
        <ListSkeleton />
      </div>
    </Skeleton>
  );
}

/** Sprint 22's "Tonight" card (FreeTonight) before either of you has said: the toggle and your partner's line. */
function FreeTonightSkeleton() {
  return (
    <div data-free-tonight className="card grid gap-3 px-4 py-3.5">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2.5">
        <SkelChip width="10.5rem" className="py-1 text-[15px]" />
        <SkelText className="text-[15px] font-semibold" width="11rem" />
      </div>
    </div>
  );
}

/** Home's "Pick for tonight" card: the dice's room, a heading and a line, then "Surprise us" and "Swipe together". */
export function PickLinkSkeleton() {
  return (
    <div data-pick-card className="card grid gap-3 py-4">
      <div className="flex items-center gap-4">
        <span className="h-14 w-16 shrink-0" />
        <span className="grid min-w-0 flex-1 gap-1">
          <span className="grid display-ink text-2xl leading-[1.05]">
            <SkelText bar="ink" width="90%" />
            <SkelText bar="ink" width="50%" />
          </span>
          <span className="grid text-sm font-medium">
            <SkelText width="95%" />
            <SkelText width="60%" />
          </span>
        </span>
        <span className="size-6 shrink-0" />
      </div>
      <div className="flex flex-wrap gap-2 sm:pl-20">
        <SkelButton width="8.5rem" icon="size-5" className="px-3 py-1.5 text-[0.95rem]" />
        <SkelButton quiet width="10rem" icon="size-6" className="px-3 py-1" />
      </div>
    </div>
  );
}

/** The list column: the three view tabs, the filter chips and a few list cards. */
export function ListSkeleton() {
  return (
    <div aria-busy className="grid grid-cols-[minmax(0,1fr)] gap-6">
      <div className="@container">
        <div className="grid grid-cols-3 gap-2 pt-2 sm:flex sm:flex-wrap sm:items-center sm:gap-3 sm:pt-1">
          {["sm:w-44", "sm:w-40", "sm:w-40"].map((width, i) => (
            <SkelTab
              key={i}
              width={undefined}
              className={`relative flex items-center justify-center gap-2 max-sm:px-1.5 max-sm:pb-1 max-sm:pt-2 max-sm:text-[min(1.35rem,4.6cqi)] ${width}`}
            />
          ))}
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {/* "We can both watch", with its couches switch (BothSwitch). */}
        <SkelChip width="13.5rem" />
        <SkelChip width="5rem" />
        <SkelChip width="5rem" />
      </div>
      <ul className="grid gap-4">
        {Array.from({ length: 4 }, (_, i) => (
          <ListCardSkeleton key={i} />
        ))}
      </ul>
    </div>
  );
}

/** One list card: the poster sets its height (64×96, 80×120 from `sm`), the title and meta beside it. */
function ListCardSkeleton() {
  return (
    <li aria-hidden className="tilt-row">
      <div className="card grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-4 p-3 sm:p-4">
        <SkelPoster size="sm" className="self-start sm:h-[120px] sm:w-20" />
        <div className="grid min-w-0 content-start gap-1">
          <SkelText className="text-xl font-bold leading-tight sm:text-2xl" width="70%" />
          <SkelText className="text-[15px] font-medium" width="30%" />
          {/* "Added by", then Watched, Drop (Sprint 26) and the Someday button (Sprint 21) share the last row. */}
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
            <SkelText className="text-sm" width="25%" />
            <span className="flex flex-wrap items-center gap-1.5">
              <SkelButton quiet width="var(--w)" icon="size-4" className="tap-area px-2.5 py-0.5 text-sm [--w:auto] sm:[--w:5.75rem]" />
              <SkelButton quiet width="var(--w)" icon="size-3.5" className="tap-area px-2.5 py-0.5 text-sm [--w:auto] sm:[--w:4.25rem]" />
              <SkelButton quiet width="6.5rem" icon="size-4" className="tap-area px-2.5 py-0.5 text-sm" />
            </span>
          </div>
        </div>
      </div>
    </li>
  );
}
