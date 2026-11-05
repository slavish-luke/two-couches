import { whoCanWatch, type Availability, type Watcher } from "@/lib/watch";
import { PosterTab } from "./poster-tab";

/**
 * The PosterTab for one title out of a batch availability lookup. Takes the pending lookup, so the list
 * renders first and the tabs stream in (dropping in as they arrive); wrap it in <Suspense>, inside the
 * poster's `.poster-frame`. `part="proof"` renders only the services that make it "both" (nothing
 * otherwise), for a line of its own.
 */
export async function AvailabilityBadge(props: {
  availability: Promise<Record<string, Availability>>;
  titleKey: string;
  me: Watcher;
  partner: Watcher | null;
  partnerName: string | null;
  language: string;
  compact?: boolean;
  index?: number;
  part?: "tab" | "proof";
}) {
  const availability = (await props.availability)[props.titleKey] ?? {};
  const { verdict, mine, theirs } = whoCanWatch(props.me, props.partner, availability);
  if (props.part === "proof") {
    if (verdict !== "both") return null;
    const names = mine[0].name === theirs[0].name ? [mine[0].name] : [mine[0].name, theirs[0].name];
    return <span className="font-semibold text-ink">{names.join(" + ")}</span>;
  }
  return (
    <PosterTab
      verdict={verdict}
      partnerName={props.partnerName}
      language={props.language}
      proof={verdict === "both" ? [mine[0].name, theirs[0].name] : undefined}
      compact={props.compact}
      index={props.index}
    />
  );
}
