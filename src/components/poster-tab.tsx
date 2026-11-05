import type { CSSProperties } from "react";
import { getMessages } from "@/lib/i18n";
import type { Verdict } from "@/lib/watch";

/**
 * Who can stream a title, as a tab stuck over the top edge of its poster (half on the poster, half above
 * it), so it takes no room of its own. Put it inside a `.poster-frame` (the poster's own width): the tab
 * sizes itself from the poster's width.
 *
 * Both of you: a tab in the "both" colour with the burst word ("Both!", or "Both of us!" once the poster
 * is 200px or wider). One of you: a paper tab with two dots (yours, then your partner's), filled for
 * whoever can, and who it is. `compact` (Home's list cards) shows the dots alone and "Free" short; the
 * words are still read out. Neither of you: nothing. `proof` names the services that make it "both"
 * (yours, theirs), for the label. `index` staggers the tabs dropping in down a list.
 */
export function PosterTab({
  verdict,
  partnerName,
  language,
  proof,
  compact = false,
  index = 0,
}: {
  verdict: Verdict;
  partnerName: string | null;
  language: string;
  proof?: [string, string];
  compact?: boolean;
  index?: number;
}) {
  const t = getMessages(language).common.watchBadge;
  if (verdict === "none") return null;

  if (verdict === "both") {
    // Often the same service in both countries: name it once.
    const services = proof && (proof[0] === proof[1] ? [proof[0]] : proof);
    const label = services ? `${t.both}. ${t.proof(services)}` : t.both;
    // Long words shrink to fit, as on the starburst.
    const fit = Math.min(1, 12 / t.stampShort.length);
    return (
      <span className="poster-tab poster-tab-both" style={{ "--i": index, "--fit": fit } as CSSProperties}>
        <span aria-hidden className="poster-tab-word">
          <span className="poster-tab-long">{t.stamp}</span>
          <span className="poster-tab-short">{t.stampShort}</span>
        </span>
        <span className="sr-only">{label}</span>
      </span>
    );
  }

  const label = { me: partnerName ? t.meOnly : t.me, partner: t.partner(partnerName ?? ""), free: t.free }[verdict];
  const shown = verdict === "free" ? (compact ? t.freeShort : t.free) : compact ? null : label;
  return (
    <span className="poster-tab poster-tab-paper" style={{ "--i": index } as CSSProperties}>
      {verdict !== "free" && (
        <span aria-hidden className="flex shrink-0 gap-1">
          <Dot filled={verdict === "me"} color="var(--me)" />
          {partnerName && <Dot filled={verdict === "partner"} color="var(--partner)" />}
        </span>
      )}
      {shown && (
        <span aria-hidden className="min-w-0 truncate">
          {shown}
        </span>
      )}
      <span className="sr-only">{label}</span>
    </span>
  );
}

/** Filled in the person's colour: they can stream it. Paper: they can't. */
function Dot({ filled, color }: { filled: boolean; color: string }) {
  return (
    <span
      className="block size-3.5 rounded-full border-[2.5px] border-outline"
      style={{ background: filled ? color : "var(--p-surface)" }}
    />
  );
}
