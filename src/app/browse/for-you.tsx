import Link from "next/link";
import type { ReactNode } from "react";
import { DismissButton } from "@/components/dismiss-button";
import { TitleCard, type CardContext } from "@/components/title-card";
import { getI18n } from "@/lib/i18n/server";
import { rankForCouple } from "@/lib/recommend-rules";
import { FOR_YOU_CHECKED, getForYou, type ForYouItem } from "@/lib/recommend";
import { getAvailability } from "@/lib/titles";
import { titleKey, whoCanWatch, type MediaType } from "@/lib/watch";

const ROW_LENGTH = 20;

/** Wordless placeholder while suggestions load: the first visit asks TMDB about each seed title. */
export function ForYouLoading() {
  return <div aria-busy className="h-72 rounded-xl bg-line/60 motion-safe:animate-pulse" />;
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
      {ranked.map((s) => (
        <TitleCard
          key={titleKey(s)}
          result={s}
          context={context}
          className="w-32 shrink-0 snap-start"
          details={<span className="line-clamp-2 text-xs text-muted">{text.like(s.because.title)}</span>}
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
    <section className="grid gap-3">
      <h2 className="flex flex-wrap items-baseline gap-x-2 font-display text-lg font-semibold">
        {props.heading}
        <span className="font-sans text-sm font-normal text-muted">{props.note}</span>
      </h2>
      {props.empty ? (
        <div className="card grid justify-items-start gap-1 text-sm text-muted">
          <p>{props.empty}</p>
          {props.link && (
            <Link href={props.link.href} className="font-semibold text-partner">
              {props.link.text}
            </Link>
          )}
        </div>
      ) : (
        <ul className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2">{props.children}</ul>
      )}
    </section>
  );
}
