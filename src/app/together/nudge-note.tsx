"use client";

import { useOptimistic, useTransition } from "react";
import { CloseIcon } from "@/components/icons";
import { NudgeSticker } from "@/components/nudge-sticker";
import { getMessages } from "@/lib/i18n";
import { timeAgo, type NudgeKind } from "@/lib/together-rules";
import { seeNudge } from "./actions";

/**
 * "Alex sent you a heart · 5 min ago" on Home's clocks panel, for the latest nudge your partner sent you,
 * until you mark it seen.
 */
export function NudgeNote(props: {
  nudge: { id: string; kind: NudgeKind; sent_at: string };
  partnerName: string;
  language: string;
  serverNow: number;
}) {
  const { nudge, partnerName, language } = props;
  const t = getMessages(language).together.nudge;
  const [, startTransition] = useTransition();
  const [hidden, hide] = useOptimistic(false, () => true);
  if (hidden) return null;

  return (
    <p
      data-nudge-note
      className="paper col-span-2 row-start-2 mt-1 flex min-w-0 items-center gap-2 rounded-control border-[2.5px] border-outline py-1 pl-1.5 pr-1 text-sm font-semibold"
    >
      <NudgeSticker kind={nudge.kind} className="size-6" />
      <span className="min-w-0 flex-1">
        {t.incoming[nudge.kind](partnerName)}
        <span className="whitespace-nowrap text-muted"> · {timeAgo(nudge.sent_at, props.serverNow, language)}</span>
      </span>
      <button
        type="button"
        aria-label={t.seen}
        title={t.seen}
        onClick={() =>
          startTransition(async () => {
            hide(null);
            await seeNudge(nudge.id);
          })
        }
        className="tap-area grid size-7 shrink-0 place-items-center rounded-full text-muted transition hover:bg-current/10 hover:text-ink"
      >
        <CloseIcon className="size-4 [stroke-width:2.75]" />
      </button>
    </p>
  );
}
