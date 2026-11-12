import Link from "next/link";
import { ArrowIcon } from "@/components/icons";
import { getI18n } from "@/lib/i18n/server";
import { getProposals, getWatchNights } from "@/lib/nights";
import { proposalView } from "@/lib/planning-rules";
import { NightCard } from "./night-card";
import { ProposalCard } from "./proposal-card";

type Person = { id: string; name: string; timeZone: string };

/**
 * Home's spotlight: the next watch night with a live countdown, or a nudge to plan one. Times your partner
 * suggested come first, to pick from; your own suggestions show while they wait or after they were turned
 * down.
 */
export async function NextNight(props: { coupleId: string; me: Person; partner: Person; locales: string[] }) {
  const [{ language, t }, [night], proposals] = await Promise.all([
    getI18n(),
    getWatchNights(props.coupleId, props.locales, { limit: 1 }),
    getProposals(props.coupleId, props.locales),
  ]);
  const now = new Date();
  const shown = proposals.flatMap((proposal) => {
    const view = proposalView(proposal, props.me.id, now);
    return view === "hidden" ? [] : [{ proposal, view }];
  });
  // Ones waiting for your answer first.
  shown.sort((a, b) => Number(b.view === "answer") - Number(a.view === "answer"));

  return (
    <section className="spotlight grid -rotate-1 gap-4 p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 className="display-pop text-[2rem]">{t.nights.next.heading}</h2>
        <Link
          href={night || shown.length > 0 ? "/watch-nights" : "/watch-nights/new"}
          className="group inline-flex items-center gap-1 font-bold underline underline-offset-4"
        >
          {night || shown.length > 0 ? t.nights.next.all : t.nights.next.planOne}
          <ArrowIcon className="size-4 transition-transform duration-200 ease-(--ease-spring) group-hover:translate-x-1" />
        </Link>
      </div>
      {shown.length > 0 && (
        <ul className="grid gap-3">
          {shown.map(({ proposal, view }) => (
            <ProposalCard
              key={proposal.id}
              proposal={proposal}
              view={view}
              me={props.me}
              partner={props.partner}
              now={now.getTime()}
              language={language}
              className="paper rounded-panel border-[3px] border-outline p-3"
            />
          ))}
        </ul>
      )}
      {night ? (
        <ul>
          <NightCard
            night={night}
            me={props.me}
            partner={props.partner}
            now={now}
            language={language}
            t={t}
            className=""
            listing
            live
          />
        </ul>
      ) : (
        shown.length === 0 && <p className="text-muted">{t.nights.next.none}</p>
      )}
    </section>
  );
}
