import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Couches } from "@/components/couch";
import { BackIcon } from "@/components/icons";
import { ListSync } from "@/components/list-sync";
import { NameTag } from "@/components/name-tag";
import { Poster, posterMorph } from "@/components/poster";
import { Stars } from "@/components/stars";
import type { Messages } from "@/lib/i18n";
import { getI18n } from "@/lib/i18n/server";
import { getList, type ListEntry } from "@/lib/list";
import { isCountry } from "@/lib/places";
import { getPartner, requireProfile } from "@/lib/session";
import { ratingGap, ratingPairs, sharedRatings } from "@/lib/taste-rules";
import { tmdbLocale } from "@/lib/tmdb";
import { titleHref } from "@/lib/watch";
import { DisagreeSkeleton } from "./skeleton";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: `${t.stats.disagree.heading} · ${t.common.appName}` };
}

export default function DisagreePage() {
  return (
    <Suspense fallback={<DisagreeSkeleton />}>
      <Disagree />
    </Suspense>
  );
}

type Person = { id: string; name: string };

/** Where you disagree: your biggest splits and closest agreements, all time, with both ratings. */
async function Disagree() {
  const [profile, partner, { language, t }] = await Promise.all([requireProfile(), getPartner(), getI18n()]);
  if (!isCountry(profile.country)) redirect("/settings?welcome=1");
  if (!profile.couple_id) redirect("/couple");
  if (!partner) redirect("/stats");

  const locale = tmdbLocale(profile.language, profile.home_country ?? profile.country);
  const locales = partner.country ? [locale, tmdbLocale(partner.language, partner.home_country)] : [locale];
  const entries = await getList(profile.couple_id, locales);
  const { splits, agreements } = ratingPairs(entries, profile.id, partner.id);
  const anyShared = sharedRatings(entries, profile.id, partner.id).length > 0;
  const me = { id: profile.id, name: t.common.you };
  const them = { id: partner.id, name: partner.display_name || t.common.yourPartner };
  const d = t.stats.disagree;

  return (
    <div className="grid gap-9">
      <ListSync coupleId={profile.couple_id} />
      <div className="grid gap-3">
        <Link
          href="/stats"
          className="tap-area group inline-flex items-center gap-1.5 justify-self-start font-bold underline underline-offset-4"
        >
          <BackIcon className="size-4 transition-transform duration-200 ease-(--ease-spring) group-hover:-translate-x-1" /> {d.back}
        </Link>
        {/* One long word in Turkish ("Anlaşamadıklarınız"): smaller on phones, and it may break rather than push the page sideways. */}
        <h1 className="display -rotate-1 text-[clamp(1.9rem,8.4vw,3.6rem)] [overflow-wrap:anywhere] sm:text-[clamp(2.4rem,5vw,3.6rem)]">{d.heading}</h1>
        <p className="font-medium text-muted">{d.intro}</p>
      </div>

      {!anyShared ? (
        <div className="card grid justify-items-center gap-3 py-10 text-center">
          <Couches size={56} />
          <p className="max-w-[28rem] font-medium text-muted">{d.empty}</p>
        </div>
      ) : (
        <>
          <PairList
            heading={d.splits}
            intro={d.splitsIntro}
            empty={d.noSplits}
            entries={splits}
            me={me}
            partner={them}
            language={language}
            t={t}
          />
          <PairList
            heading={d.agreements}
            intro={d.agreementsIntro}
            empty={d.noAgreements}
            entries={agreements}
            me={me}
            partner={them}
            language={language}
            t={t}
          />
        </>
      )}
    </div>
  );
}

function PairList(props: {
  heading: string;
  intro: string;
  empty: string;
  entries: ListEntry[];
  me: Person;
  partner: Person;
  language: string;
  t: Messages;
}) {
  const { entries, me, partner, language, t } = props;
  return (
    <section className="card grid gap-4">
      <div className="grid gap-1">
        <h2 className="display-ink text-2xl">{props.heading}</h2>
        <p className="text-muted">{props.intro}</p>
      </div>
      {entries.length === 0 ? (
        <p className="font-medium">{props.empty}</p>
      ) : (
        <ol className="grid gap-3 sm:grid-cols-2">
          {entries.map((entry) => {
            const gap = ratingGap(entry, me.id, partner.id);
            return (
              <li key={entry.id}>
                <Link
                  href={titleHref(entry)}
                  className="group flex h-full items-center gap-3.5 rounded-control border-[2.5px] border-outline bg-surface p-2.5 transition duration-150 ease-(--ease-spring) hover:-translate-y-0.5 hover:-rotate-1 hover:shadow-[var(--lift-sm)_var(--lift-sm)_0_var(--outline)]"
                >
                  <Poster
                    path={entry.poster_path}
                    title={entry.title}
                    size="sm"
                    language={language}
                    morph={posterMorph(entry)}
                  />
                  <span className="grid min-w-0 gap-1.5">
                    <span className="text-lg font-bold leading-snug group-hover:underline">{entry.title}</span>
                    <span className="grid gap-1">
                      {[
                        { person: me, who: "me" as const },
                        { person: partner, who: "partner" as const },
                      ].map(({ person, who }) => (
                        <span key={who} className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
                          <NameTag name={person.name} who={who} />
                          <Stars rating={entry.ratings[person.id]} who={person.name} language={language} />
                        </span>
                      ))}
                    </span>
                    <span
                      data-gap={gap}
                      className={`w-fit rounded-full border-2 border-outline px-2 text-[13px] font-bold leading-snug ${gap === 0 ? "bg-both-soft" : "bg-accent-soft"}`}
                    >
                      {gap === 0 ? t.stats.disagree.same : t.stats.disagree.apart(gap)}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
