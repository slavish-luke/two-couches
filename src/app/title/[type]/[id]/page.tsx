import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { Burst } from "@/components/burst";
import { DismissButton } from "@/components/dismiss-button";
import { CheckIcon, ExternalIcon } from "@/components/icons";
import { ListSync } from "@/components/list-sync";
import { Poster, posterMorph } from "@/components/poster";
import { PosterDeck } from "@/components/poster-deck";
import { RemindButton } from "@/components/remind-button";
import { getReminderKeys } from "@/lib/alerts";
import { type Messages } from "@/lib/i18n";
import { getI18n, localisedTitle } from "@/lib/i18n/server";
import { getCategories, getListItem } from "@/lib/list";
import { countryName } from "@/lib/places";
import { deckWith, getPosterDeck } from "@/lib/poster-deck";
import { getDismissedKeys } from "@/lib/recommend";
import { getDiary } from "@/lib/diary";
import { getReviews } from "@/lib/reviews";
import { getItemGuesses, getRatedList } from "@/lib/taste";
import { predictRating } from "@/lib/taste-rules";
import { getPartner, requireProfile } from "@/lib/session";
import { getAvailability, getTitle } from "@/lib/titles";
import { tmdbLocale } from "@/lib/tmdb";
import {
  isMediaType,
  tmdbImage,
  titleKey,
  whoCanWatch,
  type CountryAvailability,
  type Provider,
  type ProviderKind,
  type TitleRef,
  type Watcher,
} from "@/lib/watch";
import { ListPanel } from "./list-panel";
import { TitleSkeleton, WhereToWatchSkeleton } from "./skeleton";

export const generateMetadata = localisedTitle("title");

export default function TitlePage({ params }: PageProps<"/title/[type]/[id]">) {
  return (
    <Suspense fallback={<TitleSkeleton />}>
      <TitleView params={params} />
    </Suspense>
  );
}

async function TitleView({ params }: Pick<PageProps<"/title/[type]/[id]">, "params">) {
  const [{ type, id }, profile, { language, t }] = await Promise.all([params, requireProfile(), getI18n()]);
  const tmdbId = Number(id);
  if (!isMediaType(type) || !Number.isSafeInteger(tmdbId) || tmdbId <= 0) notFound();
  if (!profile.country) redirect("/settings?welcome=1");

  const ref: TitleRef = { media_type: type, tmdb_id: tmdbId };
  // The poster deck streams in after the page (never rejects); until then the page shows its one poster.
  const deck = getPosterDeck(ref, language);
  const title = await getTitle(ref, tmdbLocale(profile.language, profile.home_country));
  if (!title) notFound();
  const poster = (
    <Poster
      path={title.poster_path}
      title={title.title}
      size="lg"
      eager
      language={language}
      morph={posterMorph(ref)}
      className="-rotate-2 shadow-[7px_7px_0_var(--outline)] sm:h-auto sm:w-[240px]"
    />
  );

  const facts = [
    title.release_date?.slice(0, 4),
    t.common.mediaType[type],
    title.seasons ? t.title.seasons(title.seasons) : null,
    title.runtime
      ? type === "tv"
        ? t.title.episodeRuntime(t.title.runtime(title.runtime))
        : t.title.runtime(title.runtime)
      : null,
  ].filter(Boolean);

  return (
    <div className="grid gap-12">
      <div className="grid gap-x-9 gap-y-6 sm:grid-cols-[auto_minmax(0,1fr)]">
        <div className="justify-self-center sm:justify-self-start">
          <Suspense fallback={poster}>
            <TitleDeck deck={deck} first={title.poster_path} titleRef={ref} language={language} fallback={poster} />
          </Suspense>
        </div>
        <div className="grid min-w-0 content-start gap-4">
          <div className="grid gap-2">
            <h1 className="display text-[clamp(2.4rem,5vw,3.6rem)] [overflow-wrap:anywhere]">{title.title}</h1>
            {title.original_title !== title.title && <p className="text-lg font-semibold text-muted">{title.original_title}</p>}
            <p className="font-bold">{facts.join(" · ")}</p>
            {title.genres.length > 0 && (
              <ul className="flex flex-wrap gap-1.5">
                {title.genres.map((genre) => (
                  <li key={genre} className="strand">
                    {genre}
                  </li>
                ))}
              </ul>
            )}
          </div>
          {title.tagline && <p className="text-lg font-semibold text-muted">{title.tagline}</p>}
          {title.overview && <p className="max-w-[62ch] text-[1.05rem] font-medium leading-relaxed">{title.overview}</p>}
          {(title.trailer_key || profile.couple_id) && (
            <div className="flex flex-wrap gap-3 pt-1">
              {profile.couple_id && (
                <Link href={`/watch-nights/new?type=${type}&id=${tmdbId}`} className="btn">
                  {t.nights.plan}
                </Link>
              )}
              {title.trailer_key && (
                <a
                  href={`https://www.youtube.com/watch?v=${title.trailer_key}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-quiet"
                >
                  {t.title.trailer}
                  <ExternalIcon className="size-4" />
                </a>
              )}
            </div>
          )}
        </div>
      </div>

      <Suspense fallback={<WhereToWatchSkeleton />}>
        <WhereToWatch titleRef={ref} />
      </Suspense>

      {profile.couple_id && (
        <Suspense>
          <OnOurList
            titleRef={ref}
            seasons={title.seasons}
            seasonEpisodes={title.season_episodes}
            genres={title.genre_ids.map((id, i) => ({ id, name: title.genres[i] ?? "" }))}
          />
          <ListSync coupleId={profile.couple_id} />
        </Suspense>
      )}
    </div>
  );
}

/** The poster as a deck of TMDB's posters to shuffle through, or just the poster when there's only one. */
async function TitleDeck(props: {
  deck: Promise<string[]>;
  first: string | null;
  titleRef: TitleRef;
  language: string;
  fallback: ReactNode;
}) {
  const posters = deckWith(props.first, await props.deck);
  if (posters.length < 2) return props.fallback;
  return <PosterDeck posters={posters} morph={posterMorph(props.titleRef)} language={props.language} />;
}

async function OnOurList({
  titleRef,
  seasons,
  seasonEpisodes,
  genres,
}: {
  titleRef: TitleRef;
  seasons: number | null;
  seasonEpisodes: number[] | null;
  /** The title's genres (TMDB IDs and names in the viewer's language), for the predicted ratings. */
  genres: { id: number; name: string }[];
}) {
  const [profile, partner, { t }] = await Promise.all([requireProfile(), getPartner(), getI18n()]);
  const coupleId = profile.couple_id!;
  const [item, categories, dismissed] = await Promise.all([
    getListItem(coupleId, titleRef),
    getCategories(coupleId),
    getDismissedKeys(coupleId),
  ]);
  const [reviews, taste, diary] = item
    ? await Promise.all([
        getReviews([item.id], profile.id).then((byItem) => byItem[item.id]),
        tasteExtras(coupleId, item, profile.id, partner?.id ?? null, genres, profile.language),
        getDiary(item.id),
      ])
    : [null, null, null];

  return (
    <div className="grid gap-4">
      <ListPanel
        titleRef={titleRef}
        seasons={seasons}
        seasonEpisodes={seasonEpisodes}
        item={item}
        categories={categories}
        me={{ id: profile.id, name: profile.display_name || t.common.you }}
        partner={partner && { id: partner.id, name: partner.display_name || t.common.yourPartner }}
        language={profile.language}
        timeZone={profile.time_zone}
        reviews={reviews}
        predictions={taste?.predictions ?? null}
        guesses={taste?.guesses ?? []}
        diary={diary}
      />
      {!item && (
        <DismissButton titleRef={titleRef} dismissed={dismissed.has(titleKey(titleRef))} language={profile.language} long />
      )}
    </div>
  );
}

/**
 * Sprint 17's parts of the panel: each person's predicted rating while the title is still to watch, and
 * the rating guesses made on it (to veil your partner's stars until you've guessed).
 */
async function tasteExtras(
  coupleId: string,
  item: NonNullable<Awaited<ReturnType<typeof getListItem>>>,
  meId: string,
  partnerId: string | null,
  genres: { id: number; name: string }[],
  language: string,
) {
  const unwatched = item.status === "want" || item.status === "watching";
  const [rated, guesses] = await Promise.all([
    unwatched && genres.length > 0 ? getRatedList(coupleId) : null,
    partnerId ? getItemGuesses(item.id) : [],
  ]);
  const names = new Intl.ListFormat(language, { type: "conjunction" });
  const predict = (personId: string | null) => {
    if (!rated || !personId || item.ratings[personId]) return null;
    const p = predictRating(rated, personId, genres.map((g) => g.id), item.id);
    return p && { rating: p.rating, count: p.count, genres: names.format(genres.filter((g) => p.genreIds.includes(g.id)).map((g) => g.name)) };
  };
  return { predictions: rated ? { me: predict(meId), partner: predict(partnerId) } : null, guesses };
}

async function WhereToWatch({ titleRef }: { titleRef: TitleRef }) {
  const [profile, partner, { t }] = await Promise.all([requireProfile(), getPartner(), getI18n()]);
  const me: Watcher = { country: profile.country!, services: profile.services };
  const them: Watcher | null = partner?.country ? { country: partner.country, services: partner.services } : null;
  const partnerName = partner?.display_name || t.common.yourPartner;

  const [byTitle, reminded] = await Promise.all([
    getAvailability([titleRef], them ? [me.country, them.country] : [me.country]),
    profile.couple_id ? getReminderKeys(profile.couple_id) : null,
  ]);
  const availability = byTitle[titleKey(titleRef)] ?? {};
  const { verdict, mine, theirs } = whoCanWatch(me, them, availability);
  const names = (providers: Provider[]) => providers.map((p) => p.name).join(", ");
  const theirCountry = them ? countryName(them.country, profile.language) : "";

  const text = t.title.banner;
  const banner = {
    both: { heading: text.both.heading, detail: text.both.detail(names(mine), partnerName, names(theirs)) },
    me: {
      heading: them ? text.me.heading : text.me.headingAlone,
      detail: them ? text.me.detail(names(mine), partnerName, theirCountry) : text.me.detailAlone(names(mine)),
    },
    partner: {
      heading: text.partner.heading(partnerName),
      detail: text.partner.detail(partnerName, names(theirs), countryName(me.country, profile.language)),
    },
    free: { heading: t.common.watchBadge.free, detail: them ? text.free.detail : text.free.detailAlone },
    none: { heading: them ? text.none.heading : text.none.headingAlone, detail: text.none.detail },
  }[verdict];

  return (
    <section className="grid gap-6" aria-labelledby="where-to-watch">
      <h2 id="where-to-watch" className="display text-[2rem]">
        {t.title.whereToWatch}
      </h2>

      {verdict === "both" ? (
        // The screen's moment, and only when you can both watch it.
        <div className="spotlight grid items-center gap-x-6 gap-y-3 p-5 sm:-rotate-1 sm:grid-cols-[auto_minmax(0,1fr)] sm:p-6">
          <span aria-hidden className="justify-self-center">
            <Burst className="size-32 sm:size-36" textClass="text-[22px] sm:text-[25px]">
              {t.common.watchBadge.stamp}
            </Burst>
          </span>
          <div className="grid gap-2 text-center sm:text-left">
            <p className="display-pop text-[clamp(1.9rem,4vw,2.5rem)]">{banner.heading}</p>
            <p className="text-lg font-semibold">{banner.detail}</p>
          </div>
        </div>
      ) : (
        <div className="card flex items-start gap-4">
          {(verdict === "me" || verdict === "partner") && (
            // Who can stream it: a filled dot for whoever can.
            <span aria-hidden className="mt-1 flex shrink-0 gap-1">
              <span className={`size-4 rounded-full border-[2.5px] border-outline ${verdict === "me" ? "bg-me" : "bg-surface"}`} />
              {them && (
                <span
                  className={`size-4 rounded-full border-[2.5px] border-outline ${verdict === "partner" ? "bg-partner" : "bg-surface"}`}
                />
              )}
            </span>
          )}
          <div className="grid gap-1">
            <p className="display-ink text-2xl">{banner.heading}</p>
            <p className="font-medium">{banner.detail}</p>
          </div>
        </div>
      )}

      {reminded && verdict !== "both" && (
        <RemindButton titleRef={titleRef} reminded={reminded.has(titleKey(titleRef))} language={profile.language} long />
      )}
      <div className="grid gap-6 sm:grid-cols-2 sm:gap-5">
        <CountryColumn
          who={t.common.you}
          isMe
          watcher={me}
          availability={availability[me.country]}
          language={profile.language}
          timeZone={profile.time_zone}
          t={t}
        />
        {them && (
          <CountryColumn
            who={partnerName}
            isMe={false}
            watcher={them}
            availability={availability[them.country]}
            language={profile.language}
            timeZone={profile.time_zone}
            t={t}
          />
        )}
      </div>
    </section>
  );
}

/** Provider kinds in the order they're listed. */
const KINDS: ProviderKind[] = ["flatrate", "free", "ads", "rent", "buy"];

function CountryColumn(props: {
  who: string;
  isMe: boolean;
  watcher: Watcher;
  availability: CountryAvailability | undefined;
  language: string;
  timeZone: string;
  t: Messages;
}) {
  const { watcher, availability, isMe, t } = props;
  const country = countryName(watcher.country, props.language);
  const groups = KINDS.map((kind) => ({
    kind,
    providers: availability?.providers.filter((p) => p.kind === kind) ?? [],
  })).filter((g) => g.providers.length > 0);
  const paidStyle = isMe ? "bg-me-soft" : "bg-partner-soft";

  return (
    <section className="card grid content-start gap-5">
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
        <h3
          title={country}
          className={`flex max-w-full items-center gap-1 rounded-full border-[2.5px] border-outline px-3 py-0.5 text-lg font-bold ${isMe ? "bg-me" : "bg-partner"}`}
        >
          <span className="truncate">{props.who}</span>
          <span className="shrink-0 opacity-75">· {watcher.country}</span>
        </h3>
        <span className="font-semibold text-muted">{country}</span>
      </div>

      {!availability ? (
        <p className="font-medium text-muted">{t.title.couldntCheck(country)}</p>
      ) : groups.length === 0 ? (
        <p className="font-medium text-muted">{t.title.notAvailable(country)}</p>
      ) : (
        groups.map(({ kind, providers }) => (
          <div key={kind} className="grid gap-2">
            <h4 className="font-bold">{t.title.kinds[kind]}</h4>
            <ul className="flex flex-wrap gap-2">
              {providers.map((p) => {
                const pays = kind === "flatrate" && watcher.services.includes(p.provider_id);
                return (
                  <li
                    key={p.provider_id}
                    className={`flex items-center gap-2 rounded-full border-[2.5px] border-outline py-1 pl-1 pr-3 text-sm font-semibold ${
                      pays ? `${paidStyle} shadow-[var(--lift-sm)_var(--lift-sm)_0_var(--outline)]` : "bg-surface"
                    }`}
                    title={pays ? (isMe ? t.title.youPay(p.name) : t.title.theyPay(props.who, p.name)) : undefined}
                  >
                    {p.logo_path ? (
                      <Image
                        src={tmdbImage(p.logo_path, "w92")}
                        alt=""
                        width={28}
                        height={28}
                        unoptimized
                        className="size-7 rounded-full border-2 border-outline"
                      />
                    ) : (
                      <span aria-hidden className="size-7 rounded-full border-2 border-outline bg-surface" />
                    )}
                    {p.name}
                    {pays && (
                      <>
                        <CheckIcon className="size-4" />
                        <span className="sr-only">{isMe ? t.title.youPayLabel : t.title.theyPayLabel}</span>
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))
      )}

      {availability && (
        <p className="border-t-2 border-outline/15 pt-3 text-sm text-muted">
          {t.title.checked(
            new Intl.DateTimeFormat(props.language, {
              day: "numeric",
              month: "short",
              hour: "numeric",
              minute: "2-digit",
              timeZone: props.timeZone,
            }).format(new Date(availability.checked_at)),
          )}
          {availability.link && (
            <>
              {" · "}
              <a
                href={availability.link}
                target="_blank"
                rel="noopener noreferrer"
                className="font-bold text-ink underline underline-offset-4"
              >
                {t.title.justWatch}
              </a>
            </>
          )}
        </p>
      )}
    </section>
  );
}
