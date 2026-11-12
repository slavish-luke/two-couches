import Link from "next/link";
import { ExternalIcon, WarningIcon } from "@/components/icons";
import { doesTheDogDieUrl, matchingWarnings, type AgeRating, type Keyword } from "@/lib/guidance-rules";
import { getAgeRatings, getTitleKeywords, getWarnKeywords } from "@/lib/guidance";
import { getI18n } from "@/lib/i18n/server";
import { countryName } from "@/lib/places";
import { getPartner, requireProfile } from "@/lib/session";
import type { TitleRef } from "@/lib/watch";

/**
 * "Before you watch" (Sprint 19): each of your countries' age ratings, "Heads up" for topics on your own
 * "Warn me about" list that the title is tagged with (and your partner's, said as theirs), and a link out to
 * DoesTheDogDie. Wrap it in <Suspense> with GuidanceSkeleton.
 */
export async function ContentGuidance({ titleRef, title, originalTitle }: { titleRef: TitleRef; title: string; originalTitle: string }) {
  const [profile, partner, { language, t }] = await Promise.all([requireProfile(), getPartner(), getI18n()]);
  const text = t.discovery.guidance;
  const people = [
    { id: profile.id, name: t.common.you, country: profile.country!, isMe: true },
    ...(partner?.country
      ? [{ id: partner.id, name: partner.display_name || t.common.yourPartner, country: partner.country, isMe: false }]
      : []),
  ];
  const countries = [...new Set(people.map((p) => p.country))];
  const [ratings, keywords, warnLists] = await Promise.all([
    getAgeRatings(titleRef, countries).catch((error) => {
      console.error("Loading age ratings failed", error);
      return null;
    }),
    getTitleKeywords(titleRef).catch((error) => {
      console.error("Loading a title's keywords failed", error);
      return [] as Keyword[];
    }),
    profile.couple_id ? getWarnKeywords(profile.couple_id) : ({} as Record<string, Keyword[]>),
  ]);
  const names = (list: Keyword[]) => new Intl.ListFormat(language, { type: "conjunction" }).format(list.map((k) => k.name));
  const mine = matchingWarnings(keywords, warnLists[profile.id] ?? []);
  const theirs = partner ? matchingWarnings(keywords, warnLists[partner.id] ?? []) : [];
  const hasList = (warnLists[profile.id] ?? []).length > 0;
  // DoesTheDogDie is in English: an English viewer's title, else the original one.
  const searchTitle = language === "en" ? title : originalTitle;

  return (
    <section data-guidance aria-labelledby="guidance" className="card grid gap-5">
      <h2 id="guidance" className="display-ink text-2xl">
        {text.heading}
      </h2>

      {(mine.length > 0 || theirs.length > 0) && (
        <div className="grid gap-2">
          {mine.length > 0 && (
            <div className="flex items-start gap-2.5 rounded-control border-[2.5px] border-outline bg-danger-soft px-3 py-2">
              <WarningIcon className="mt-0.5 size-6 shrink-0" />
              <div className="grid">
                <p className="text-lg font-bold leading-snug">{text.headsUp(names(mine))}</p>
                <p className="text-sm font-medium">{text.headsUpNote}</p>
              </div>
            </div>
          )}
          {theirs.length > 0 && (
            <p className="flex items-start gap-2.5 font-semibold">
              <span aria-hidden className="mt-1.5 size-3.5 shrink-0 rounded-full border-2 border-outline bg-partner" />
              {text.partnerWarn(people[1]?.name ?? t.common.yourPartner, names(theirs))}
            </p>
          )}
        </div>
      )}

      <div className="grid gap-2">
        <h3 className="font-bold">{text.ages}</h3>
        <ul className="flex flex-wrap gap-2">
          {people.map((person) => (
            <RatingTag
              key={person.id}
              who={person.name}
              country={person.country}
              countryLabel={countryName(person.country, language)}
              rating={ratings?.[person.country] ?? null}
              isMe={person.isMe}
              none={text.noRating}
            />
          ))}
        </ul>
      </div>

      <div className="grid justify-items-start gap-1.5 border-t-2 border-outline/15 pt-4">
        <a href={doesTheDogDieUrl(searchTitle)} target="_blank" rel="noopener noreferrer" className="btn-quiet text-sm">
          {text.dtdd}
          <ExternalIcon className="size-4" />
        </a>
        <p className="text-sm text-muted">{text.dtddNote}</p>
        {!hasList && profile.couple_id && (
          <Link href="/settings#warn" className="tap-area text-sm font-bold underline underline-offset-4">
            {text.setUp}
          </Link>
        )}
      </div>
    </section>
  );
}

/** One person's age rating: a split tag with their name and country, then the rating there. */
function RatingTag(props: {
  who: string;
  country: string;
  countryLabel: string;
  rating: AgeRating | null;
  isMe: boolean;
  none: string;
}) {
  return (
    <li
      title={props.countryLabel}
      className="flex max-w-full items-stretch overflow-hidden rounded-full border-[2.5px] border-outline bg-surface text-[15px] font-semibold leading-snug"
    >
      <span className={`flex min-w-0 items-center gap-1 border-r-[2.5px] border-outline px-2.5 font-bold ${props.isMe ? "bg-me" : "bg-partner"}`}>
        <span className="truncate">{props.who}</span>
        <span className="shrink-0 opacity-75">· {props.country}</span>
      </span>
      <span className={`flex items-center px-2.5 ${props.rating ? "font-bold" : "text-muted"}`}>
        {props.rating ? props.rating.rating : props.none}
        {props.rating && props.rating.descriptors.length > 0 && (
          <span className="ml-1.5 font-medium text-muted">({props.rating.descriptors.join(", ")})</span>
        )}
      </span>
    </li>
  );
}
