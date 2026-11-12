import Form from "next/form";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense, type CSSProperties } from "react";
import { AddButton } from "@/components/add-button";
import { Couches } from "@/components/couch";
import { ArrowIcon, GlobeIcon } from "@/components/icons";
import { ListSync } from "@/components/list-sync";
import { Poster } from "@/components/poster";
import { PosterTab } from "@/components/poster-tab";
import type { Messages } from "@/lib/i18n";
import { getI18n, localisedTitle } from "@/lib/i18n/server";
import { formatDate, localDate } from "@/lib/list-rules";
import { formatShortTime } from "@/lib/night-rules";
import {
  daySeed,
  listOnlyCount,
  MAX_MINUTES,
  MIN_MINUTES,
  minutesUntilLate,
  moodsOf,
  parseAnother,
  parseTimeChoice,
  pickAt,
  pickOrder,
  pickSeed,
  QUICK_MINUTES,
  type Mood,
} from "@/lib/pick-rules";
import { countryName, isCountry } from "@/lib/places";
import { ourCountries } from "@/lib/time-rules";
import { getPartner, requireProfile } from "@/lib/session";
import { tmdbLocale } from "@/lib/tmdb";
import { streamableFor, titleHref, type Watcher } from "@/lib/watch";
import { MoodSync } from "./couple-changes";
import { forYouCandidates, getMoods, listCandidates, madeInOurs, type PickItem } from "./data";
import { tagsFor } from "./describe";
import { MoodCheck } from "./mood-check";
import { PickCardSkeleton, PickSkeleton } from "./skeleton";
import { ShuffleIcon, Surprise, SURPRISE_CARDS } from "./surprise";

export const generateMetadata = localisedTitle("pick");

export default function PickPage({ searchParams }: PageProps<"/pick">) {
  return (
    <Suspense fallback={<PickSkeleton />}>
      <PickForTonight searchParams={searchParams} />
    </Suspense>
  );
}

/**
 * What's in the URL: `?time=120` (or `late`), `all=1` to include what only one of you can watch, `n` for
 * "Another". `surprise=1` (Home's "Surprise us") isn't kept in links: it only shuffles the pick in once.
 * `made=1` (Sprint 22) keeps to titles made in one of your home countries.
 */
type PickState = { time: string | null; everything: boolean; made: boolean; another: number };

function pickHref(state: PickState, changes: Partial<PickState>) {
  const next = { ...state, ...changes };
  const params = new URLSearchParams();
  if (next.time) params.set("time", next.time);
  if (next.everything) params.set("all", "1");
  if (next.made) params.set("made", "1");
  if (next.another > 0) params.set("n", String(next.another));
  const query = params.toString();
  return query ? `/pick?${query}` : "/pick";
}

/** A chip link, grape while it's the current choice (drawn here: the chip class selects on aria-pressed). */
const chip = (active: boolean) =>
  `chip ${active ? "bg-accent text-on-accent shadow-[var(--lift-sm)_var(--lift-sm)_0_var(--outline)]" : ""}`;

async function PickForTonight({ searchParams }: Pick<PageProps<"/pick">, "searchParams">) {
  const [profile, partner, params, { language, t }] = await Promise.all([
    requireProfile(),
    getPartner(),
    searchParams,
    getI18n(),
  ]);
  if (!isCountry(profile.country)) redirect("/settings?welcome=1");
  if (!profile.couple_id) redirect("/couple");

  const text = t.pick;
  const choice = parseTimeChoice(params.time);
  // Without a partner's country nothing is watchable by both, so everything counts.
  const them: Watcher | null = partner?.country ? { country: partner.country, services: partner.services } : null;
  // Both of your home countries, sorted, so both screens keep to the same titles.
  const homes = ourCountries([profile.home_country, partner?.home_country]);
  const homeNames = homes.map((code) => countryName(code, language)).join(t.time.made.or);
  const state: PickState = {
    time: choice ? (choice.kind === "late" ? "late" : String(choice.minutes)) : null,
    everything: params.all === "1" || !them,
    made: params.made === "1" && homes.length > 0,
    another: parseAnother(params.n),
  };
  const partnerName = partner?.display_name || t.common.yourPartner;
  const now = new Date();
  const moods = await getMoods(profile.couple_id, profile, partner, now);

  let minutes: number | null = null;
  let summary: string | null = null;
  if (choice?.kind === "minutes") {
    minutes = choice.minutes;
    summary = text.have(t.title.runtime(minutes));
  } else if (choice?.kind === "late") {
    const zones = partner ? [profile.time_zone, partner.time_zone] : [profile.time_zone];
    const late = minutesUntilLate(now, zones);
    const byPartner = late.limitedBy === 1;
    if (late.minutes < MIN_MINUTES) {
      summary = byPartner ? text.untilLate.tooLatePartner(partnerName) : text.untilLate.tooLateYou;
    } else {
      minutes = late.minutes;
      const length = t.title.runtime(minutes);
      summary = byPartner
        ? text.untilLate.partner(
            partnerName,
            formatShortTime(late.endsAt, partner!.time_zone, language),
            formatShortTime(late.endsAt, profile.time_zone, language),
            length,
          )
        : text.untilLate.you(formatShortTime(late.endsAt, profile.time_zone, language), length);
    }
  }

  const locale = tmdbLocale(profile.language, profile.home_country ?? profile.country);
  const locales = partner?.country ? [locale, tmdbLocale(partner.language, partner.home_country)] : [locale];

  return (
    <div className="grid gap-8">
      <ListSync coupleId={profile.couple_id} />
      <MoodSync coupleId={profile.couple_id} />
      <div className="grid gap-3">
        <h1 className="display -rotate-1 text-[clamp(2.4rem,5vw,3.6rem)]">{text.heading}</h1>
        <p className="max-w-[60ch] text-lg font-medium">{text.intro}</p>
      </div>

      <section className="card grid gap-4" aria-labelledby="pick-time">
        <h2 id="pick-time" className="display-ink text-2xl">
          {text.time.label}
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          {QUICK_MINUTES.map((m) => (
            <Link
              key={m}
              href={pickHref(state, { time: String(m), another: 0 })}
              aria-current={state.time === String(m) ? "true" : undefined}
              className={chip(state.time === String(m))}
            >
              {t.title.runtime(m)}
            </Link>
          ))}
          <Link
            href={pickHref(state, { time: "late", another: 0 })}
            aria-current={state.time === "late" ? "true" : undefined}
            className={chip(state.time === "late")}
          >
            {text.time.late}
          </Link>
        </div>
        <Form action="/pick" className="flex max-w-xs items-end gap-2.5">
          <label className="grid flex-1 gap-1.5 text-sm font-bold">
            {text.time.custom}
            <input
              name="time"
              type="number"
              inputMode="numeric"
              required
              min={MIN_MINUTES}
              max={MAX_MINUTES}
              step={5}
              defaultValue={choice?.kind === "minutes" && !(QUICK_MINUTES as readonly number[]).includes(choice.minutes) ? choice.minutes : undefined}
              className="field text-base font-medium"
            />
          </label>
          {state.everything && them && <input type="hidden" name="all" value="1" />}
          {state.made && <input type="hidden" name="made" value="1" />}
          <button className="btn-quiet py-2">{text.time.go}</button>
        </Form>
      </section>

      {summary && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-lg font-bold">{summary}</p>
          {minutes !== null && (them || homes.length > 0) && (
            <div className="flex flex-wrap gap-2">
              {them && (
                <Link
                  href={pickHref(state, { everything: !state.everything, another: 0 })}
                  className="chip"
                  aria-pressed={!state.everything}
                >
                  <span aria-hidden className="size-3 rounded-full border-2 border-outline bg-stamp" />
                  {text.bothOnly}
                </Link>
              )}
              {homes.length > 0 && (
                <Link
                  href={pickHref(state, { made: !state.made, another: 0 })}
                  className="chip"
                  aria-pressed={state.made}
                  title={t.time.made.names(homeNames)}
                >
                  <GlobeIcon className="size-4" />
                  {homes.length > 1 ? t.time.made.ours : t.time.made.one(homeNames)}
                  {homes.length > 1 && <span className="sr-only"> ({t.time.made.names(homeNames)})</span>}
                </Link>
              )}
            </div>
          )}
        </div>
      )}

      {minutes !== null && (
        <Suspense
          key={pickHref(state, {})}
          fallback={<PickCardSkeleton />}
        >
          <PickResult
            couple={{
              coupleId: profile.couple_id,
              locales,
              countries: them && them.country !== profile.country ? [profile.country, them.country] : [profile.country],
              me: { country: profile.country, services: profile.services },
              partner: them,
            }}
            minutes={minutes}
            state={state}
            homes={homes}
            moods={[moods.mine, moods.theirs]}
            surprise={params.surprise === "1"}
            now={now}
            timeZone={profile.time_zone}
            partnerName={them ? partnerName : null}
            language={language}
            t={t}
          />
        </Suspense>
      )}

      <MoodCheck mine={moods.mine} theirs={moods.theirs} partnerName={partner ? partnerName : null} language={language} />

      <Link
        href="/pick/swipe"
        className="group card flex items-center gap-4 py-4 transition duration-150 ease-(--ease-spring) hover:-translate-y-1 hover:-rotate-1 hover:shadow-[8px_8px_0_var(--outline)]"
      >
        <ShuffleIcon className="size-12" />
        <span className="grid min-w-0 flex-1 gap-1">
          <span className="display-ink text-2xl leading-[1.05]">{text.swipe.entry.heading}</span>
          <span className="text-sm font-medium text-muted">{text.swipe.entry.body}</span>
        </span>
        <ArrowIcon className="size-6 transition-transform duration-200 ease-(--ease-spring) group-hover:translate-x-1" />
      </Link>
    </div>
  );
}

/** The pick for this many minutes and presses of "Another", or why there isn't one. */
async function PickResult(props: {
  couple: Parameters<typeof listCandidates>[0];
  minutes: number;
  state: PickState;
  /** Both of your home countries, for "Made in our countries". */
  homes: string[];
  /** Both of your moods today (yours first), or null where there's none. */
  moods: (Mood | null)[];
  /** Arrived from "Surprise us": the pick shuffles in. */
  surprise: boolean;
  now: Date;
  timeZone: string;
  partnerName: string | null;
  language: string;
  t: Messages;
}) {
  const { couple, minutes, state, t } = props;
  const day = daySeed(props.now);
  // Both moods feed the seed (sorted), so both screens still land on the same pick.
  const options = { minutes, everything: state.everything, seed: pickSeed(day, props.moods), moods: moodsOf(props.moods) };

  const whole = await listCandidates(couple);
  // "Made in our countries": the same titles on both screens, whoever is looking (homes are sorted).
  const origins = state.made ? props.homes : undefined;
  const list = origins ? await madeInOurs(whole, origins, couple.locales[0]) : whole;
  let candidates = list;
  let failed = false;
  // The list's titles of known length come first, so suggestions are only loaded once they've all had a turn.
  if (state.another >= listOnlyCount(list, options)) {
    try {
      candidates = [...list, ...(await forYouCandidates(couple, day, state.everything, origins))];
    } catch (error) {
      console.error("Loading suggestions for the pick failed", error);
      failed = true;
    }
  }
  const order = pickOrder(candidates, options);
  const result = pickAt(order, state.another);

  if (!result) {
    return (
      <div className="card grid justify-items-center gap-3 px-6 py-10 text-center">
        <Couches size={56} />
        <p className="display-ink text-2xl">{t.pick.empty.heading(t.title.runtime(minutes))}</p>
        {whole.length === 0 && <p className="max-w-[48ch] text-muted">{t.pick.empty.noList}</p>}
        {failed && <p className="max-w-[48ch] text-muted">{t.pick.failed}</p>}
        <div className="flex flex-wrap justify-center gap-3 pt-1">
          {state.made && (
            <Link href={pickHref(state, { made: false, another: 0 })} className="btn-quiet">
              {t.time.made.anyCountry}
            </Link>
          )}
          {!state.everything && (
            <Link href={pickHref(state, { everything: true, another: 0 })} className="btn-quiet">
              {t.pick.empty.tryEverything}
            </Link>
          )}
          {state.time !== "late" && minutes < MAX_MINUTES && (
            <Link href={pickHref(state, { time: String(Math.min(MAX_MINUTES, minutes + 30)), another: 0 })} className="btn">
              {t.pick.empty.tryLonger}
            </Link>
          )}
        </div>
      </div>
    );
  }

  // A surprise shuffles a few of the titles that come after it past first (any it has, going round).
  const shuffle = props.surprise
    ? [...new Set(Array.from({ length: order.length - 1 }, (_, i) => order[(result.position + 1 + i) % order.length].poster_path))]
        .filter((path): path is string => Boolean(path) && path !== result.pick.poster_path)
        .slice(0, SURPRISE_CARDS)
    : null;

  return (
    <PickCard
      item={result.pick}
      shuffle={shuffle}
      wrapped={result.round > 0 && result.position === 0}
      anotherHref={pickHref(state, { another: state.another + 1 })}
      startOverHref={state.another > 0 ? pickHref(state, { another: 0 }) : null}
      me={couple.me}
      partner={couple.partner}
      timeZone={props.timeZone}
      partnerName={props.partnerName}
      language={props.language}
      t={t}
    />
  );
}

function reasonFor(item: PickItem, timeZone: string, language: string, t: Messages) {
  if (item.source === "forYou") return item.because ? t.pick.reasons.because(item.because) : null;
  if (item.status === "watching") {
    return item.season && item.episode
      ? t.pick.reasons.upTo(t.common.progress(item.season, item.episode))
      : t.pick.reasons.watching;
  }
  return item.created_at
    ? t.pick.reasons.onListSince(formatDate(localDate(timeZone, new Date(item.created_at)), language))
    : null;
}

function PickCard(props: {
  item: PickItem;
  /** "Surprise us": other posters to shuffle past before this one lands, or null for a plain deal. */
  shuffle: string[] | null;
  wrapped: boolean;
  anotherHref: string;
  startOverHref: string | null;
  me: Watcher;
  partner: Watcher | null;
  timeZone: string;
  partnerName: string | null;
  language: string;
  t: Messages;
}) {
  const { item, language, t } = props;
  const text = t.pick;
  const reason = reasonFor(item, props.timeZone, language, t);
  const names = (watcher: Watcher) => streamableFor(watcher, item.availability).map((p) => p.name).join(", ");
  const mine = names(props.me);
  const theirs = props.partner ? names(props.partner) : "";
  const ref = { media_type: item.media_type, tmdb_id: item.tmdb_id };

  const tags = tagsFor(item, t);
  const shuffle = props.shuffle;
  // While a surprise shuffles in, the details wait (globals.css, Sprint 16).
  const reveal = shuffle ? "surprise-reveal" : "";

  return (
    // The screen's one spotlight. Phones: a small poster beside the details, actions across the bottom.
    // Wider: a big poster, actions under the details.
    <>
      <article
        data-surprise={shuffle ? "" : undefined}
        style={{ "--tilt": "-0.75deg", rotate: "var(--tilt)", "--n": shuffle?.length ?? 0 } as CSSProperties}
        className="pick-deal spotlight grid grid-cols-[7.5rem_minmax(0,1fr)] gap-x-4 gap-y-5 p-4 sm:grid-cols-[220px_minmax(0,1fr)] sm:grid-rows-[auto_1fr] sm:gap-x-7 sm:p-6"
      >
        <Link
          href={titleHref(item)}
          className="self-start transition duration-150 ease-(--ease-spring) hover:-translate-y-1 sm:row-span-2"
        >
          {/* Who can watch it rides on a tab over the poster's top edge, tipped with it. */}
          <div className="poster-frame -rotate-2">
            <div className={shuffle ? "surprise-poster" : undefined}>
              <Poster
                path={item.poster_path}
                title={item.title}
                size="fluid"
                eager
                language={language}
                className="shadow-[6px_6px_0_var(--outline)]"
              />
              <PosterTab verdict={item.verdict} partnerName={props.partnerName} language={language} />
            </div>
            {shuffle && <Surprise posters={shuffle} sfx={text.surprise.sfx} />}
          </div>
        </Link>
        <div className={`grid min-w-0 content-start gap-3 ${reveal}`}>
          {props.wrapped && <p className="text-sm font-semibold text-muted">{text.wrapped}</p>}
          <h2 className="display-pop text-[clamp(1.8rem,4vw,2.75rem)] [overflow-wrap:anywhere]">
            <Link href={titleHref(item)} className="decoration-[3px] underline-offset-[6px] hover:underline">
              {item.title}
            </Link>
          </h2>
          <ul className="flex flex-wrap gap-1.5">
            {tags.map((tag) => (
              <li key={tag} className="paper rounded-full border-[2.5px] border-outline px-2.5 text-sm font-bold">
                {tag}
              </li>
            ))}
          </ul>
          {reason && <p className="font-semibold">{reason}</p>}
          {(mine || (theirs && props.partnerName)) && (
            <div className="grid justify-items-start gap-2 text-sm">
              {mine && <ServiceLine who="me" text={text.services.you(mine)} />}
              {theirs && props.partnerName && <ServiceLine who="partner" text={text.services.partner(props.partnerName, theirs)} />}
            </div>
          )}
        </div>
        <div className={`col-span-2 grid content-start gap-3 sm:col-span-1 sm:col-start-2 ${reveal}`}>
          <div className="flex flex-wrap items-center gap-2.5">
            <Link href={titleHref(item)} className="btn">
              {text.watchNow}
              <ArrowIcon className="size-4" />
            </Link>
            <Link href={`/watch-nights/new?type=${item.media_type}&id=${item.tmdb_id}`} className="btn-quiet">
              {text.planIt}
            </Link>
            <Link href={props.anotherHref} scroll={false} className="group btn-quiet">
              <DiceIcon className="size-5 transition-transform duration-300 ease-(--ease-spring) group-hover:rotate-[100deg]" />
              {text.another}
            </Link>
            {item.source === "forYou" && <AddButton titleRef={ref} onList={false} language={language} />}
          </div>
          {props.startOverHref && (
            <Link href={props.startOverHref} scroll={false} className="tap-area justify-self-start text-sm font-bold underline underline-offset-4">
              {text.startOver}
            </Link>
          )}
        </div>
      </article>
    </>
  );
}

/** Who streams it on what: a dot in the person's colour, then the services. */
function ServiceLine({ who, text }: { who: "me" | "partner"; text: string }) {
  return (
    <span className="flex items-center gap-2 font-semibold">
      <span aria-hidden className={`size-3 shrink-0 rounded-full border-2 border-outline ${who === "me" ? "bg-me" : "bg-partner"}`} />
      {text}
    </span>
  );
}

/** A die showing five, for "Another". */
function DiceIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className={`inline-block shrink-0 ${className}`}>
      <rect x="3" y="3" width="18" height="18" rx="5" fill="var(--surface)" stroke="currentColor" strokeWidth={2} />
      {[
        [8.5, 8.5],
        [15.5, 8.5],
        [12, 12],
        [8.5, 15.5],
        [15.5, 15.5],
      ].map(([cx, cy]) => (
        <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={1.6} fill="currentColor" />
      ))}
    </svg>
  );
}
