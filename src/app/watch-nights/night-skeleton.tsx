import { SkelButton, SkelChip, SkelPoster, SkelText } from "@/components/skeleton";

/**
 * A `<NightCard>` while it loads, block for block: the poster, title, a ticket per person, how you'll
 * watch, the ready check and the prep list (when `actions`) and the links. `className` replaces the card frame, as on
 * NightCard; `listing` is its larger poster and numerals. `aside` is for Home's narrow aside from `lg`,
 * where the how-line, the ready check's buttons and the links wrap onto more lines.
 */
export function NightCardSkeleton({
  className = "card p-4",
  listing = false,
  actions = true,
  aside = false,
}: {
  className?: string;
  listing?: boolean;
  actions?: boolean;
  aside?: boolean;
}) {
  const wrapped = aside ? "hidden lg:block" : "hidden";
  return (
    <li
      aria-hidden
      className={`flex items-start gap-4 max-sm:grid max-sm:grid-cols-[4rem_minmax(0,1fr)] max-sm:gap-x-3 max-sm:gap-y-2 ${className}`}
    >
      <SkelPoster size={listing ? "md" : "sm"} className="max-sm:row-span-2 max-sm:h-24 max-sm:w-16" />
      <div className="grid min-w-0 flex-1 content-start gap-2 max-sm:contents max-sm:*:col-span-2 max-sm:[&>:nth-child(-n+2)]:col-span-1">
        <div>
          <SkelText className="text-xl font-bold leading-snug" width="65%" />
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          {[0, 1].map((i) => (
            <div key={i} className="paper @container grid min-w-0 content-start gap-0.5 rounded-control border-[3px] border-outline px-2.5 pb-1.5 pt-1">
              <SkelText className="text-xs font-bold" width="55%" />
              <SkelText
                bar="ink"
                className={`display-ink whitespace-nowrap leading-none ${listing ? "text-[min(clamp(1.35rem,2.2vw,1.7rem),19cqi)]" : "text-[min(1.5rem,19cqi)]"}`}
                width="70%"
              />
              <SkelText className="text-xs font-semibold" width="45%" />
            </div>
          ))}
        </div>
        <div className="grid text-sm">
          <SkelText width="40%" />
          <SkelText className={wrapped} width="70%" />
        </div>
        {actions && (
          <div className="paper grid gap-2.5 rounded-control border-[3px] border-outline p-3 text-sm">
            <SkelText className="text-base font-bold" width="40%" />
            {/* Fixed widths, so the button drops under the name like the real one where the card is narrow. */}
            <div className="grid gap-2">
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
                <span className="w-14 rounded-full border-[2.5px] border-outline bg-me px-2.5 font-bold">{" "}</span>
                <SkelText width="5.5rem" />
                <SkelButton width="6rem" className="px-3.5 pb-1.5 pt-2 text-base" />
              </div>
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
                <span className="w-14 rounded-full border-[2.5px] border-outline bg-partner px-2.5 font-bold">{" "}</span>
                <SkelText width="5.5rem" />
              </div>
            </div>
            <div className="grid">
              <SkelText width="85%" />
              <SkelText className={aside ? "sm:hidden lg:block" : "sm:hidden"} width="40%" />
            </div>
          </div>
        )}
        {actions && (
          // The prep list as it starts: its head and a row of ideas.
          <div className="paper grid gap-2.5 rounded-control border-[3px] border-outline p-3 text-sm">
            <SkelText className="text-base font-bold" width="35%" />
            <div className="flex flex-wrap items-center gap-1.5">
              {["5.5rem", "8.5rem", "9.5rem", "8rem"].map((width, i) => (
                <SkelChip key={i} width={width} className="gap-1 px-2.5 py-0.5 text-[13px]" />
              ))}
            </div>
          </div>
        )}
        {/* The folded comment thread's toggle (Sprint 20). */}
        <div className="text-sm font-bold">
          <SkelText width="7rem" />
        </div>
        <div className="grid text-sm">
          <SkelText width={actions ? "60%" : "35%"} />
          {actions && <SkelText className={wrapped} width="35%" />}
        </div>
      </div>
    </li>
  );
}
