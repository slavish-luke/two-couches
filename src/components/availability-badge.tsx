import { whoCanWatch, type Availability, type Watcher } from "@/lib/watch";
import { WatchBadge } from "./watch-badge";

/**
 * WatchBadge for one title out of a batch availability lookup. Takes the pending lookup, so the list
 * renders first and badges stream in; wrap it in <Suspense>.
 */
export async function AvailabilityBadge(props: {
  availability: Promise<Record<string, Availability>>;
  titleKey: string;
  me: Watcher;
  partner: Watcher | null;
  partnerName: string | null;
  language: string;
}) {
  const availability = (await props.availability)[props.titleKey] ?? {};
  const { verdict } = whoCanWatch(props.me, props.partner, availability);
  return <WatchBadge verdict={verdict} partnerName={props.partnerName} language={props.language} />;
}
