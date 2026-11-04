import { getMessages } from "@/lib/i18n";
import type { Verdict } from "@/lib/watch";
import { Burst } from "./burst";

const BURST_SIZES = {
  sm: { className: "size-16", textClass: "text-[13px]" },
  md: { className: "size-20", textClass: "text-[15px]" },
  lg: { className: "size-24", textClass: "text-[19px]" },
} as const;

/**
 * Who can stream this: the bubblegum starburst when you can both watch it, otherwise two outlined dots
 * (yours, then your partner's), filled for whoever can. Renders nothing when neither of you can.
 *
 * `proof` names the services that make it "both" (yours, theirs): always in the burst's label, and shown
 * beside it with `showProof`. `onPoster` puts the dots on a paper tag so they read over artwork. `index`
 * staggers the bursts popping in down a list.
 */
export function WatchBadge({
  verdict,
  partnerName,
  language,
  proof,
  showProof = false,
  onPoster = false,
  index = 0,
  size = "md",
}: {
  verdict: Verdict;
  partnerName: string | null;
  language: string;
  proof?: [string, string];
  showProof?: boolean;
  onPoster?: boolean;
  index?: number;
  size?: keyof typeof BURST_SIZES;
}) {
  const t = getMessages(language).common.watchBadge;
  if (verdict === "none") return null;

  if (verdict === "both") {
    // Often the same service in both countries: name it once.
    const services = proof && (proof[0] === proof[1] ? [proof[0]] : proof);
    const label = services ? `${t.both}. ${t.proof(services)}` : t.both;
    return (
      <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
        <Burst index={index} title={label} {...BURST_SIZES[size]}>
          <span aria-hidden>{size === "sm" ? t.stampShort : t.stamp}</span>
          <span className="sr-only">{label}</span>
        </Burst>
        {showProof && services && (
          <span aria-hidden className="text-sm font-semibold">
            {services.join(" + ")}
          </span>
        )}
      </span>
    );
  }

  const label = { me: partnerName ? t.meOnly : t.me, partner: t.partner(partnerName ?? ""), free: t.free }[verdict];
  const backing = onPoster ? "rounded-full border-2 border-outline bg-surface px-2 py-0.5 text-ink" : "";
  return (
    <span className={`inline-flex items-center gap-1.5 text-sm font-semibold ${backing}`}>
      {verdict !== "free" && (
        <span aria-hidden className="flex gap-1">
          <Dot filled={verdict === "me"} color="var(--me)" />
          {partnerName && <Dot filled={verdict === "partner"} color="var(--partner)" />}
        </span>
      )}
      {label}
    </span>
  );
}

/** Filled in the person's colour: they can stream it. White: they can't. */
function Dot({ filled, color }: { filled: boolean; color: string }) {
  return (
    <span
      className="size-3.5 rounded-full border-[2.5px] border-outline"
      style={{ background: filled ? color : "var(--surface)" }}
    />
  );
}
