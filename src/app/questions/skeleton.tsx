import { NBSP, Skeleton, SkelButton, SkelField, SkelPageTitle, SkelParagraph, SkelText } from "@/components/skeleton";

/** /questions while it loads: the back link, heading and intro, then a few days' cards. */
export function QuestionsSkeleton() {
  return (
    <Skeleton className="grid gap-9">
      <div className="grid gap-3">
        <SkelText className="font-bold" width="6rem" />
        <SkelPageTitle width="15rem" />
        <SkelParagraph lines={1} smLines={2} className="font-medium" />
      </div>
      <div className="grid gap-5">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="card grid gap-3">
            <SkelText className="text-sm font-bold" width="5rem" />
            <SkelText className="text-lg font-bold leading-snug" width="85%" />
            <div className="grid gap-2.5">
              <div className="grid gap-2">
                <div className="grid gap-1.5">
                  <span className="text-sm font-bold">{NBSP}</span>
                  <SkelField lines={2} />
                </div>
                <SkelButton width="7rem" className="px-4 pb-1.5 pt-2 text-base" />
              </div>
              <SkelText className="text-sm" width="55%" />
            </div>
          </div>
        ))}
      </div>
    </Skeleton>
  );
}
