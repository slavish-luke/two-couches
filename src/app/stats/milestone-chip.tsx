import Link from "next/link";
import { getI18n } from "@/lib/i18n/server";
import { getCurrentProfile, getPartner } from "@/lib/session";
import { getNightsAt, getRatedList } from "@/lib/taste";
import { homeHighlight, type Highlight } from "@/lib/taste-rules";
import { StickerArt } from "./sticker";

/** The sticker drawn at the chip's start (the couch for a film). */
const STICKER: Record<Highlight["kind"], "oneYear" | "streak" | "firstNight"> = {
  anniversary: "oneYear",
  streak: "streak",
  film: "firstNight",
};

/**
 * Home's milestone chip: one line linking to Stats when there's something to celebrate (the anniversary of
 * your first watch night, a streak of 2+ weeks, or the film you just watched as "Film #N together"), else
 * nothing. Self-contained: it loads its own (light) data. No boundary of its own, like Home's next-night
 * card: it arrives with the aside, so nothing below it jumps.
 */
export async function MilestoneChip() {
  const [profile, partner, { t }] = await Promise.all([getCurrentProfile(), getPartner(), getI18n()]);
  if (!profile?.couple_id || !partner) return null;
  const zones = { [profile.id]: profile.time_zone, [partner.id]: partner.time_zone };
  const [entries, nights] = await Promise.all([
    getRatedList(profile.couple_id),
    getNightsAt(profile.couple_id, zones, profile.time_zone),
  ]);
  const highlight = homeHighlight(entries, nights, new Date(), profile.time_zone);
  if (!highlight) return null;
  const text =
    highlight.kind === "anniversary"
      ? t.stats.chip.anniversary(highlight.years)
      : highlight.kind === "streak"
        ? t.stats.chip.streak(highlight.weeks)
        : t.stats.chip.film(highlight.number);
  return (
    <Link
      href="/stats"
      data-milestone-chip
      className="chip w-fit max-w-full -rotate-1 justify-self-start py-1 pl-1.5 text-[15px] font-bold"
    >
      <StickerArt id={STICKER[highlight.kind]} className="milestone-chip-art size-7 shrink-0" />
      <span className="min-w-0 truncate">{text}</span>
    </Link>
  );
}
