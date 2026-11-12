import { NBSP, SkelButton, SkelField, SkelText } from "@/components/skeleton";

/**
 * Home's question card while it loads, block for block: the heading and "Past questions", the question (two
 * lines), your answer box and the line about your partner's. Wordless.
 */
export function QuestionSkeleton() {
  return (
    <div aria-hidden data-question-card className="card grid gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <SkelText bar="ink" className="display-ink text-2xl" width="60%" />
        <SkelText className="text-sm font-bold" width="7rem" />
      </div>
      <span className="grid text-xl font-bold leading-snug">
        <SkelText width="95%" />
        <SkelText width="55%" />
      </span>
      <div className="grid gap-2.5">
        <div className="grid gap-2">
          <div className="grid gap-1.5">
            <span className="text-sm font-bold">{NBSP}</span>
            <SkelField lines={2} />
          </div>
          <SkelButton width="7rem" className="px-4 pb-1.5 pt-2 text-base" />
        </div>
        <SkelText className="text-sm" width="60%" />
      </div>
    </div>
  );
}
