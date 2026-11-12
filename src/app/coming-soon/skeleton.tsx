import { Couches } from "@/components/couch";
import { SkelButton, Skeleton, SkelPageTitle, SkelParagraph, SkelTab, SkelText, SkelTitleCard } from "@/components/skeleton";

/**
 * Coming soon while it loads: the heading and intro, the alerts panel (as it is with no new alerts), the
 * Films / Series tabs and the release rows.
 */
export function ComingSoonSkeleton() {
  return (
    <Skeleton className="grid gap-8">
      <div className="grid gap-3">
        <SkelPageTitle width="12rem" />
        <SkelParagraph className="font-medium" lines={2} smLines={1} />
      </div>
      <div className="card grid gap-3">
        <SkelText bar="ink" className="display-ink text-2xl" width="40%" />
        <div className="grid justify-items-start gap-3 sm:flex sm:items-center sm:gap-4">
          <Couches size={48} />
          <SkelParagraph className="w-full font-medium" lines={4} smLines={2} />
        </div>
      </div>
      <div className="-mx-1 flex items-center gap-3 overflow-hidden px-1 pb-2 pt-1">
        <SkelTab width="7.5rem" className="shrink-0" />
        <SkelTab width="7.5rem" className="shrink-0" />
      </div>
      <ReleaseRowsSkeleton />
    </Skeleton>
  );
}

/** The release rows (in cinemas, coming to digital): a heading, a note and a strip of cards each. */
export function ReleaseRowsSkeleton() {
  return (
    <div aria-busy className="grid gap-8">
      {[0, 1].map((row) => (
        <div key={row} className="grid gap-1">
          <SkelText bar="lettering" className="display text-[2rem]" width="12rem" />
          <SkelText className="text-sm font-medium" width="70%" />
          <ul className="-mx-4 flex gap-4 overflow-hidden px-4 pb-4 pt-6">
            {Array.from({ length: 6 }, (_, i) => (
              <SkelTitleCard key={i} className="w-36 shrink-0" details={<CountryDates />} extra={<CardButtons />} />
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

/** "Remind us" and "Can't wait" under each card. */
function CardButtons() {
  return (
    <>
      <SkelButton quiet width="6.5rem" className="px-2.5 py-0.5 text-sm" />
      <SkelButton quiet width="7.5rem" className="px-2.5 py-0.5 text-sm" />
    </>
  );
}

/** A film's date in each country: two split tags. */
function CountryDates() {
  return (
    <span className="grid justify-items-start gap-1">
      {["bg-me", "bg-partner"].map((fill) => (
        <span key={fill} className="flex overflow-hidden rounded-full border-2 border-outline bg-surface text-[13px] font-semibold leading-snug">
          <span className={`w-7 border-r-2 border-outline ${fill}`} />
          <span className="w-14">{" "}</span>
        </span>
      ))}
    </span>
  );
}
