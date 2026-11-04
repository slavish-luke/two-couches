import { whoCanWatch, type Availability, type Watcher } from "@/lib/watch";
import { WatchBadge } from "./watch-badge";

/**
 * WatchBadge for one title out of a batch availability lookup. Takes the pending lookup, so the list
 * renders first and badges stream in (the starburst pops in as it arrives); wrap it in <Suspense>.
 * `part="proof"` renders only the services that make it "both" (nothing otherwise), for a line of its own.
 */
export async function AvailabilityBadge(props: {
  availability: Promise<Record<string, Availability>>;
  titleKey: string;
  me: Watcher;
  partner: Watcher | null;
  partnerName: string | null;
  language: string;
  showProof?: boolean;
  onPoster?: boolean;
  index?: number;
  part?: "mark" | "proof";
  size?: "sm" | "md" | "lg";
}) {
  const availability = (await props.availability)[props.titleKey] ?? {};
  const { verdict, mine, theirs } = whoCanWatch(props.me, props.partner, availability);
  if (props.part === "proof") {
    if (verdict !== "both") return null;
    const names = mine[0].name === theirs[0].name ? [mine[0].name] : [mine[0].name, theirs[0].name];
    return <span className="font-semibold text-ink">{names.join(" + ")}</span>;
  }
  return (
    <WatchBadge
      verdict={verdict}
      partnerName={props.partnerName}
      language={props.language}
      proof={verdict === "both" ? [mine[0].name, theirs[0].name] : undefined}
      showProof={props.showProof}
      onPoster={props.onPoster}
      index={props.index}
      size={props.size}
    />
  );
}
