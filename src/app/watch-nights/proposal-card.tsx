"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { CheckIcon } from "@/components/icons";
import { getMessages } from "@/lib/i18n";
import { formatDay, formatTime, rateSlot } from "@/lib/night-rules";
import type { NightProposal } from "@/lib/nights";
import { canPick, type ProposalView } from "@/lib/planning-rules";
import { answerProposal, removeProposal, type NightResult } from "./actions";

type Person = { id: string; name: string; timeZone: string };

/**
 * Times one of you suggested for a watch night. Your partner's: pick one (it becomes the night) or "None of
 * these work". Your own: waiting (withdraw), declined or expired (suggest others, put away). `className`
 * replaces the card frame (the home page shows it on paper inside its spotlight).
 */
export function ProposalCard(props: {
  proposal: NightProposal;
  view: Exclude<ProposalView, "hidden">;
  me: Person;
  partner: Person | null;
  /** The server's clock (ms), so the first render matches. */
  now: number;
  language: string;
  className?: string;
}) {
  const { proposal, view, me, partner, language } = props;
  const all = getMessages(language);
  const t = all.nights.proposal;
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  const partnerName = partner?.name ?? all.common.yourPartner;
  const zones = partner ? [me.timeZone, partner.timeZone] : [me.timeZone];

  function run(action: () => Promise<NightResult>) {
    setError(undefined);
    startTransition(async () => {
      const result = await action();
      if (result.error) setError(result.error);
    });
  }

  const textButton = "tap-area text-sm font-bold text-ink underline underline-offset-4 disabled:opacity-50";

  return (
    <li data-proposal={view} aria-busy={pending} className={`grid gap-3 ${props.className ?? "card p-4"}`}>
      <div className="grid gap-0.5">
        <p className="text-lg font-bold leading-snug">{view === "answer" ? t.heading(partnerName) : t.headingMine}</p>
        <p className="text-sm">
          <span data-item-title className="font-bold">
            {proposal.title?.title ?? all.nights.noTitle}
          </span>
          {proposal.method && <span> · {all.nights.methods[proposal.method]}</span>}
        </p>
        {proposal.notes && <p className="whitespace-pre-line text-sm">{proposal.notes}</p>}
      </div>

      {view === "answer" && <p className="text-sm font-semibold">{t.pickOne}</p>}

      {/* Each time as a ticket on both clocks; yours to pick from when your partner suggested them. */}
      <ul className="grid gap-2 sm:grid-cols-[repeat(auto-fill,minmax(10.5rem,1fr))]">
        {proposal.times.map((at, i) => {
          const start = new Date(at);
          const open = canPick(start, new Date(props.now));
          const great = partner && rateSlot(start, zones) === "great";
          const mine = `${formatDay(start, me.timeZone, language)}, ${formatTime(start, me.timeZone, language)}`;
          const body = (
            <>
              <span className="flex items-center gap-1.5 text-xs font-bold">
                <span aria-hidden className="size-2.5 shrink-0 rounded-full border-2 border-outline bg-me" />
                {formatDay(start, me.timeZone, language)}
                {!open && <span className="font-semibold text-muted">· {t.passed}</span>}
              </span>
              <span className="display-ink whitespace-nowrap text-2xl leading-none">{formatTime(start, me.timeZone, language)}</span>
              {partner && (
                <span className="flex min-w-0 items-start gap-1.5 text-xs font-semibold">
                  <span aria-hidden className="mt-0.5 size-2.5 shrink-0 rounded-full border-2 border-outline bg-partner" />
                  <span className="min-w-0">
                    {all.nights.timeFor(
                      partner.name,
                      `${formatDay(start, partner.timeZone, language)}, ${formatTime(start, partner.timeZone, language)}`,
                    )}
                  </span>
                </span>
              )}
              {great && (
                <span
                  role="img"
                  aria-label={all.nights.form.legend.great}
                  className="absolute -right-2 -top-2 grid size-6 rotate-12 place-items-center rounded-full border-2 border-outline bg-accent text-on-accent"
                >
                  <CheckIcon className="size-3.5 [stroke-width:3.5]" />
                </span>
              )}
            </>
          );
          const ticket = "paper relative grid min-w-0 content-start gap-0.5 rounded-control border-[3px] border-outline px-2.5 pb-1.5 pt-1 text-left";
          return (
            <li key={at} className="min-w-0">
              {view === "answer" ? (
                <button
                  type="button"
                  disabled={pending || !open}
                  aria-label={t.pickLabel(mine)}
                  onClick={() => run(() => answerProposal(proposal.id, i))}
                  data-pick-time
                  className={`${ticket} w-full transition duration-150 ease-(--ease-spring) enabled:hover:-translate-x-0.5 enabled:hover:-translate-y-0.5 enabled:hover:-rotate-1 enabled:hover:shadow-[var(--lift-sm)_var(--lift-sm)_0_var(--outline)] enabled:active:translate-0 enabled:active:shadow-none disabled:opacity-45`}
                >
                  {body}
                </button>
              ) : (
                <div className={`${ticket} ${open ? "" : "opacity-60"}`}>{body}</div>
              )}
            </li>
          );
        })}
      </ul>

      {view === "declined" && <p className="font-semibold">{t.declined(partnerName)}</p>}
      {view === "expired" && <p className="font-semibold">{t.expired}</p>}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {view === "answer" && (
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              if (window.confirm(t.confirmNone(partnerName))) run(() => answerProposal(proposal.id, null));
            }}
            className="btn-quiet text-sm"
          >
            {t.none}
          </button>
        )}
        {view === "waiting" && (
          <>
            <span className="text-sm font-semibold text-muted">{t.waiting(partnerName)}</span>
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                if (window.confirm(t.confirmWithdraw)) run(() => removeProposal(proposal.id));
              }}
              className={textButton}
            >
              {t.withdraw}
            </button>
          </>
        )}
        {(view === "declined" || view === "expired") && (
          <>
            <Link href="/watch-nights/new" className="btn px-3.5 pb-1.5 pt-2 text-base">
              {t.suggestOthers}
            </Link>
            <button type="button" disabled={pending} onClick={() => run(() => removeProposal(proposal.id))} className={textButton}>
              {t.putAway}
            </button>
          </>
        )}
        {pending && <span className="text-sm text-muted">{t.working}</span>}
      </div>

      {error && (
        <p role="alert" className="text-sm font-semibold text-danger">
          {error}
        </p>
      )}
    </li>
  );
}
