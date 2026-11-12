"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useOptimistic, useState, useTransition } from "react";
import { useCoupleChanges } from "@/app/pick/couple-changes";
import { Couches } from "@/components/couch";
import { ArrowIcon, CheckIcon, MoonIcon } from "@/components/icons";
import { getMessages } from "@/lib/i18n";
import { setFreeTonight } from "./actions";

/**
 * Home's "Tonight" card: your "I'm free tonight" toggle (your own evening), whether your partner has said
 * the same for theirs, and once you both have, the best time tonight to plan a night for (tonightSlot()).
 * Your partner's tap arrives live.
 */
export function FreeTonight({
  coupleId,
  mine,
  partner,
  slot,
  language,
}: {
  coupleId: string;
  /** Whether you said you're free tonight. */
  mine: boolean;
  /** Your partner and whether they're free on their own tonight; null until they've joined. */
  partner: { name: string; free: boolean } | null;
  /** Where "Plan a night" goes, and the best start on both clocks (null when no hour suits you both tonight). */
  slot: { href: string; mine: string; theirs: string } | null;
  language: string;
}) {
  const t = getMessages(language).time.free;
  const router = useRouter();
  const [shown, setShown] = useOptimistic(mine);
  const [saving, startSaving] = useTransition();
  const [failed, setFailed] = useState(false);
  useCoupleChanges(coupleId, "free_evenings", () => router.refresh());

  function toggle() {
    const next = !shown;
    startSaving(async () => {
      setShown(next);
      const result = await setFreeTonight(next);
      setFailed(!result.ok);
    });
  }

  const both = shown && partner?.free;

  return (
    <section
      data-free-tonight
      data-both={both ? "" : undefined}
      aria-label={t.label}
      aria-busy={saving || undefined}
      className={`card grid gap-3 px-4 py-3.5 ${both ? "bg-accent-soft" : ""}`}
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2.5">
        <button type="button" className="chip py-1 text-[15px]" aria-pressed={shown} onClick={toggle}>
          {shown ? <CheckIcon className="size-4 [stroke-width:3]" /> : <MoonIcon className="size-4" />}
          {t.mine.off}
        </button>
        {partner && (
          <span className="flex min-w-0 items-center gap-2 text-[15px] font-semibold">
            <span
              aria-hidden
              className={`size-3.5 shrink-0 rounded-full border-2 border-outline ${partner.free ? "bg-partner" : "bg-surface"}`}
            />
            <span className="min-w-0">{partner.free ? t.partner.free(partner.name) : t.partner.unknown(partner.name)}</span>
          </span>
        )}
      </div>
      {failed && (
        <p role="alert" className="text-sm font-semibold text-danger">
          {t.failed}
        </p>
      )}
      {both && partner && (
        <div className="grid gap-2.5 border-t-2 border-outline/15 pt-3">
          <div className="flex items-center gap-3">
            <Couches size={34} className="shrink-0" />
            <p className="display-ink text-xl leading-tight">{t.both.heading}</p>
          </div>
          <p className="text-sm font-semibold">
            {slot ? t.both.slot(slot.mine, slot.theirs, partner.name) : t.both.noSlot}
          </p>
          <Link href={slot?.href ?? "/watch-nights/new"} className="btn justify-self-start">
            {t.both.plan}
            <ArrowIcon className="size-4" />
          </Link>
        </div>
      )}
    </section>
  );
}
