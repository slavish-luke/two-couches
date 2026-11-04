import Link from "next/link";
import type { ReactNode } from "react";
import { Couches } from "@/components/couch";
import { DismissButton } from "@/components/dismiss-button";
import { ArrowIcon } from "@/components/icons";
import { TitleCard, type CardContext } from "@/components/title-card";
import { getI18n } from "@/lib/i18n/server";
import { rankForCouple } from "@/lib/recommend-rules";
import { FOR_YOU_CHECKED, getForYou, type ForYouItem } from "@/lib/recommend";
import { getAvailability } from "@/lib/titles";
import { titleKey, whoCanWatch, type MediaType } from "@/lib/watch";

/** A fixed selection, three across in the rail (six across on tablets). */
const ROW_LENGTH = 6;

/** Wordless placeholder while suggestions load: the first visit asks TMDB about each seed title. */
export function ForYouLoading() {
  return <div aria-busy className="h-96 rounded-panel border-[3px] border-outline bg-accent shadow-[6px_6px_0_var(--outline)] motion-safe:animate-pulse" />;
}

/**
 * Suggestions from the couple's list and ratings (see getForYou()), ones you can both watch first, each
 * with the liked title that led to it and "not interested".
 */
export async function ForYouRow(props: {
  coupleId: string;
  type: MediaType;
  /** Both partners' TMDB locales, the viewer's first. */
  locales: string[];
  countries: string[];
  today: string;
  card: Omit<CardContext, "availability">;
}) {
  const { card } = props;
  const { t } = await getI18n();
  const text = t.browse.forYou;

  let found: Awaited<ReturnType<typeof getForYou>>;
  try {
    found = await getForYou(props.coupleId, props.type, props.locales, props.today);
  } catch (error) {
    console.error("Loading suggestions failed", error);
    return <ForYouSection heading={text.heading} note={text.note} empty={text.failed} />;
  }
  if (found.seeds === 0) {
    return (
      <ForYouSection
        heading={text.heading}
        note={text.note}
        empty={text.noSeeds}
        link={{ href: "/?view=watched", text: text.toWatched }}
      />
    );
  }

  const top = found.suggestions.slice(0, FOR_YOU_CHECKED);
  const byTitle = await getAvailability(top, props.countries);
  const ranked: ForYouItem[] = rankForCouple(
    top,
    (s) => whoCanWatch(card.me, card.them, byTitle[titleKey(s)] ?? {}).verdict,
  ).slice(0, ROW_LENGTH);
  if (ranked.length === 0) return <ForYouSection heading={text.heading} note={text.note} empty={text.nothingNew} />;

  const context: CardContext = { ...card, availability: Promise.resolve(byTitle) };
  return (
    <ForYouSection heading={text.heading} note={text.note}>
      {ranked.map((s, i) => (
        <TitleCard
          key={titleKey(s)}
          result={s}
          context={context}
          index={i}
          eager={i < 3}
          className="text-sm"
          details={<span className="line-clamp-2 text-[13px] font-medium leading-snug text-muted">{text.like(s.because.title)}</span>}
        >
          <DismissButton
            titleRef={{ media_type: s.media_type, tmdb_id: s.tmdb_id }}
            dismissed={false}
            language={card.language}
          />
        </TitleCard>
      ))}
    </ForYouSection>
  );
}

function ForYouSection(props: {
  heading: string;
  note: string;
  empty?: string;
  link?: { href: string; text: string };
  children?: ReactNode;
}) {
  return (
    <section className="spotlight grid rotate-[-0.6deg] gap-5 p-5 pb-6">
      <h2 className="grid gap-1.5">
        <span className="display-pop text-[2rem]">{props.heading}</span>
        <span className="text-sm font-medium text-muted">{props.note}</span>
      </h2>
      {props.empty ? (
        <div className="grid justify-items-start gap-3">
          <Couches size={48} />
          <p className="max-w-prose font-medium">{props.empty}</p>
          {props.link && (
            <Link href={props.link.href} className="btn-quiet text-sm">
              {props.link.text} <ArrowIcon />
            </Link>
          )}
        </div>
      ) : (
        <ul className="grid grid-cols-3 gap-x-3 gap-y-6 pt-1 sm:grid-cols-6 lg:grid-cols-3">{props.children}</ul>
      )}
    </section>
  );
}
