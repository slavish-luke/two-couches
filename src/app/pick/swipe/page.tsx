import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Couches } from "@/components/couch";
import { BackIcon } from "@/components/icons";
import type { Messages } from "@/lib/i18n";
import { getI18n, localisedTitle } from "@/lib/i18n/server";
import { daySeed, matchesOf, moodsOf, pickSeed, swipeOrder, type Mood } from "@/lib/pick-rules";
import { isCountry } from "@/lib/places";
import { getPartner, requireProfile } from "@/lib/session";
import { tmdbLocale } from "@/lib/tmdb";
import { titleHref, titleKey, type Watcher } from "@/lib/watch";
import { MoodSync } from "../couple-changes";
import { forYouCandidates, getMoods, getSwipes, listCandidates } from "../data";
import { tagsFor } from "../describe";
import { MoodCheck } from "../mood-check";
import { SwipeDeckSkeleton, SwipeSkeleton } from "../skeleton";
import { SwipeDeck, type DeckCard } from "./swipe-deck";

export const generateMetadata = localisedTitle("swipe");

export default function SwipePage({ searchParams }: PageProps<"/pick/swipe">) {
  return (
    <Suspense fallback={<SwipeSkeleton />}>
      <Swipe searchParams={searchParams} />
    </Suspense>
  );
}

async function Swipe({ searchParams }: Pick<PageProps<"/pick/swipe">, "searchParams">) {
  const [profile, partner, params, { language, t }] = await Promise.all([
    requireProfile(),
    getPartner(),
    searchParams,
    getI18n(),
  ]);
  if (!isCountry(profile.country)) redirect("/settings?welcome=1");
  if (!profile.couple_id) redirect("/couple");

  const text = t.pick.swipe;
  // Without a partner's country nothing is watchable by both, so everything counts.
  const them: Watcher | null = partner?.country ? { country: partner.country, services: partner.services } : null;
  const everything = params.all === "1" || !them;
  const partnerName = partner ? partner.display_name || t.common.yourPartner : null;
  const now = new Date();
  const day = daySeed(now);
  const moods = await getMoods(profile.couple_id, profile, partner, now);

  const locale = tmdbLocale(profile.language, profile.home_country ?? profile.country);
  const locales = partner?.country ? [locale, tmdbLocale(partner.language, partner.home_country)] : [locale];

  return (
    <div className="grid gap-8">
      <MoodSync coupleId={profile.couple_id} />
      <div className="grid gap-3">
        <Link href="/pick" className="tap-area inline-flex items-center gap-1.5 justify-self-start text-sm font-bold underline underline-offset-4">
          <BackIcon className="size-4" />
          {text.back}
        </Link>
        <h1 className="display -rotate-1 text-[clamp(2.4rem,5vw,3.6rem)]">{text.heading}</h1>
        <p className="max-w-[60ch] text-base font-medium sm:text-lg">{text.intro}</p>
        {them && (
          <Link
            href={everything ? "/pick/swipe" : "/pick/swipe?all=1"}
            className="chip justify-self-start"
            aria-current={!everything ? "true" : undefined}
          >
            <span aria-hidden className="size-3 rounded-full border-2 border-outline bg-stamp" />
            {t.pick.bothOnly}
          </Link>
        )}
      </div>

      <Suspense key={everything ? "all" : "both"} fallback={<SwipeDeckSkeleton />}>
        <Deck
          couple={{
            coupleId: profile.couple_id,
            locales,
            countries: them && them.country !== profile.country ? [profile.country, them.country] : [profile.country],
            me: { country: profile.country, services: profile.services },
            partner: them,
          }}
          myId={profile.id}
          day={day}
          moods={[moods.mine, moods.theirs]}
          everything={everything}
          partnerName={partnerName}
          language={language}
          t={t}
        />
      </Suspense>

      <MoodCheck mine={moods.mine} theirs={moods.theirs} partnerName={partnerName} language={language} />
    </div>
  );
}

/** The day's deck: Up next, then For you, in the same seeded order on both screens. */
async function Deck(props: {
  couple: Parameters<typeof listCandidates>[0];
  myId: string;
  day: string;
  moods: (Mood | null)[];
  everything: boolean;
  partnerName: string | null;
  language: string;
  t: Messages;
}) {
  const { couple, day, everything, t } = props;
  const [list, swipes] = await Promise.all([listCandidates(couple), getSwipes(couple.coupleId, day, props.myId)]);
  let candidates = list;
  try {
    candidates = [...list, ...(await forYouCandidates(couple, day, everything))];
  } catch (error) {
    console.error("Loading suggestions for the swipe deck failed", error);
  }
  const ordered = swipeOrder(candidates, { everything, seed: pickSeed(day, props.moods), moods: moodsOf(props.moods) });

  if (ordered.length === 0) {
    return (
      <div className="card grid justify-items-center gap-3 px-6 py-10 text-center">
        <Couches size={56} />
        <p className="display-ink text-2xl">{t.pick.swipe.empty.heading}</p>
        <p className="max-w-[48ch] text-muted">{t.pick.swipe.empty.body}</p>
        {!everything && (
          <Link href="/pick/swipe?all=1" className="btn-quiet">
            {t.pick.swipe.tryEverything}
          </Link>
        )}
      </div>
    );
  }

  const cards: DeckCard[] = ordered.map((c) => ({
    key: titleKey(c),
    media_type: c.media_type,
    tmdb_id: c.tmdb_id,
    title: c.title,
    poster_path: c.poster_path,
    verdict: c.verdict,
    tags: tagsFor(c, t),
    href: titleHref(c),
  }));
  return (
    <SwipeDeck
      coupleId={couple.coupleId}
      day={day}
      cards={cards}
      initialMine={swipes.mine}
      initialStatus={{ partnerCount: Object.keys(swipes.theirs).length, matches: matchesOf(swipes.mine, swipes.theirs, []) }}
      partnerName={props.partnerName}
      language={props.language}
    />
  );
}
