import { getMessages } from "@/lib/i18n";
import type { Verdict } from "@/lib/watch";

/** Short "who can stream this" label for lists. Renders nothing when neither of you can. */
export function WatchBadge({
  verdict,
  partnerName,
  language,
}: {
  verdict: Verdict;
  partnerName: string | null;
  language: string;
}) {
  const t = getMessages(language).common.watchBadge;
  const label = {
    both: t.both,
    me: partnerName ? t.meOnly : t.me,
    partner: t.partner(partnerName ?? ""),
    free: t.free,
    none: null,
  }[verdict];
  if (!label) return null;

  const style = {
    both: "bg-both-soft text-both",
    me: "bg-me-soft text-me",
    partner: "bg-partner-soft text-partner",
    free: "border border-line text-muted",
    none: "",
  }[verdict];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${style}`}>
      {verdict === "both" && <span aria-hidden>●</span>}
      {label}
    </span>
  );
}
