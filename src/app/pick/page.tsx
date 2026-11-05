import Form from "next/form";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense, type CSSProperties } from "react";
import { AddButton } from "@/components/add-button";
import { Couches } from "@/components/couch";
import { ArrowIcon } from "@/components/icons";
import { ListSync } from "@/components/list-sync";
import { PageLoading } from "@/components/page-loading";
import { Poster } from "@/components/poster";
import { PosterTab } from "@/components/poster-tab";
import type { Messages } from "@/lib/i18n";
import { getI18n, localisedTitle } from "@/lib/i18n/server";
import { formatDate, localDate } from "@/lib/list-rules";
import { formatShortTime } from "@/lib/night-rules";
import {
  daySeed,
  DEFAULT_EPISODE_MIN,
  lengthOf,
  listOnlyCount,
  MAX_MINUTES,
  MIN_MINUTES,
  minutesUntilLate,
  parseAnother,
  parseTimeChoice,
  pickAt,
  pickOrder,
  QUICK_MINUTES,
} from "@/lib/pick-rules";
import { isCountry } from "@/lib/places";
import { getPartner, requireProfile } from "@/lib/session";
import { tmdbLocale } from "@/lib/tmdb";
import { streamableFor, titleHref, type Watcher } from "@/lib/watch";
import { forYouCandidates, listCandidates, type PickItem } from "./data";

export const generateMetadata = localisedTitle("pick");

export default function PickPage({ searchParams }: PageProps<"/pick">) {
  return (
    <Suspense fallback={<PageLoading />}>
      <PickForTonight searchParams={searchParams} />
    </Suspense>
  );
}

/** What's in the URL: `?time=120` (or `late`), `all=1` to include what only one of you can watch, `n` for "Another". */
type PickState = { time: string | null; everything: boolean; another: number };

function pickHref(state: PickState, changes: Partial<PickState>) {
  const next = { ...state, ...changes };
  const params = new URLSearchParams();
  if (next.time) params.set("time", next.time);
  if (next.everything) params.set("all", "1");
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
  const state: PickState = {
    time: choice ? (choice.kind === "late" ? "late" : String(choice.minutes)) : null,
    everything: params.all === "1" || !them,
    another: parseAnother(params.n),
  };
  const partnerName = partner?.display_name || t.common.yourPartner;
  const now = new Date();

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
          <button className="btn-quiet py-2">{text.time.go}</button>
        </Form>
      </section>

      {summary && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-lg font-bold">{summary}</p>
          {them && minutes !== null && (
            <Link
              href={pickHref(state, { everything: !state.everything, another: 0 })}
              className="chip"
              aria-pressed={!state.everything}
            >
              <span aria-hidden className="size-3 rounded-full border-2 border-outline bg-stamp" />
              {text.bothOnly}
            </Link>
          )}
        </div>
      )}

      {minutes !== null && (
        <Suspense
          key={pickHref(state, {})}
          fallback={
            <div aria-busy className="h-80 rounded-panel border-[3px] border-outline bg-surface/60 motion-safe:animate-pulse" />
          }
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
            now={now}
            timeZone={profile.time_zone}
            partnerName={them ? partnerName : null}
            language={language}
            t={t}
          />
        </Suspense>
      )}
    </div>
  );
}

/** The pick for this many minutes and presses of "Another", or why there isn't one. */
async function PickResult(props: {
  couple: Parameters<typeof listCandidates>[0];
  minutes: number;
  state: PickState;
  now: Date;
  timeZone: string;
  partnerName: string | null;
  language: string;
  t: Messages;
}) {
  const { couple, minutes, state, t } = props;
  const options = { minutes, everything: state.everything, seed: daySeed(props.now) };

  const list = await listCandidates(couple);
  let candidates = list;
  let failed = false;
  // The list's titles of known length come first, so suggestions are only loaded once they've all had a turn.
  if (state.another >= listOnlyCount(list, options)) {
    try {
      candidates = [...list, ...(await forYouCandidates(couple, options.seed, state.everything))];
    } catch (error) {
      console.error("Loading suggestions for the pick failed", error);
      failed = true;
    }
  }
  const result = pickAt(pickOrder(candidates, options), state.another);

  if (!result) {
    return (
      <div className="card grid justify-items-center gap-3 px-6 py-10 text-center">
        <Couches size={56} />
        <p className="display-ink text-2xl">{t.pick.empty.heading(t.title.runtime(minutes))}</p>
        {list.length === 0 && <p className="max-w-[48ch] text-muted">{t.pick.empty.noList}</p>}
        {failed && <p className="max-w-[48ch] text-muted">{t.pick.failed}</p>}
        <div className="flex flex-wrap justify-center gap-3 pt-1">
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

  return (
    <PickCard
      item={result.pick}
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

function lengthFor(item: PickItem, t: Messages) {
  const length = lengthOf(item);
  if (length === null) return t.pick.length.unknown;
  if (item.media_type === "movie") return t.pick.length.film(t.title.runtime(length));
  return item.runtime ? t.pick.length.episode(t.title.runtime(length)) : t.pick.length.episodeGuess(t.title.runtime(DEFAULT_EPISODE_MIN));
}

function PickCard(props: {
  item: PickItem;
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

  const tags = [item.release_date?.slice(0, 4), t.common.mediaType[item.media_type], lengthFor(item, t)].filter(Boolean);

  return (
    // The screen's one spotlight. Phones: a small poster beside the details, actions across the bottom.
    // Wider: a big poster, actions under the details.
    <>
      <article
        style={{ "--tilt": "-0.75deg", rotate: "var(--tilt)" } as CSSProperties}
        className="pick-deal spotlight grid grid-cols-[7.5rem_minmax(0,1fr)] gap-x-4 gap-y-5 p-4 sm:grid-cols-[220px_minmax(0,1fr)] sm:grid-rows-[auto_1fr] sm:gap-x-7 sm:p-6"
      >
        <Link
          href={titleHref(item)}
          className="self-start transition duration-150 ease-(--ease-spring) hover:-translate-y-1 sm:row-span-2"
        >
          {/* Who can watch it rides on a tab over the poster's top edge, tipped with it. */}
          <div className="poster-frame -rotate-2">
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
        </Link>
        <div className="grid min-w-0 content-start gap-3">
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
        <div className="col-span-2 grid content-start gap-3 sm:col-span-1 sm:col-start-2">
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
