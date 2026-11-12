import { NBSP, Skeleton, SkelPoster, SkelText } from "@/components/skeleton";

/** One list's blank rows: the poster, the title, both name tags with stars, and the "apart" tag. */
function PairRows({ rows }: { rows: number }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3.5 rounded-control border-[2.5px] border-outline bg-surface p-2.5">
          <SkelPoster size="sm" />
          <span className="grid min-w-0 flex-1 gap-1.5">
            <SkelText className="text-lg font-bold leading-snug" width="75%" />
            <span className="grid gap-1">
              {["bg-me", "bg-partner"].map((fill) => (
                <span key={fill} className="flex items-center gap-x-2">
                  <span className={`w-12 rounded-full border-[2.5px] border-outline px-2.5 text-sm font-bold ${fill}`}>{NBSP}</span>
                  <SkelText width="5rem" />
                </span>
              ))}
            </span>
            <span className="w-24 rounded-full border-2 border-outline bg-accent-soft px-2 text-[13px] font-bold leading-snug">{NBSP}</span>
          </span>
        </div>
      ))}
    </div>
  );
}

/** /stats/disagree while it loads: the back link, heading and intro, then both lists' cards. */
export function DisagreeSkeleton() {
  return (
    <Skeleton className="grid gap-9">
      <div className="grid gap-3">
        <SkelText className="font-bold" width="8rem" />
        <SkelText bar="lettering" width="14rem" className="display -rotate-1 text-[clamp(1.9rem,8.4vw,3.6rem)] sm:text-[clamp(2.4rem,5vw,3.6rem)]" />
        <SkelText className="font-medium" width="80%" />
      </div>
      {[2, 2].map((rows, i) => (
        <div key={i} className="card grid gap-4">
          <div className="grid gap-1">
            <SkelText bar="ink" className="display-ink text-2xl" width="45%" />
            <SkelText width="65%" />
          </div>
          <PairRows rows={rows} />
        </div>
      ))}
    </Skeleton>
  );
}
