import Form from "next/form";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AddButton } from "@/components/add-button";
import { ListSync } from "@/components/list-sync";
import { PageLoading } from "@/components/page-loading";
import { Poster } from "@/components/poster";
import { WatchBadge } from "@/components/watch-badge";
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

const chip = (active: boolean) =>
  `rounded-full border px-3 py-1 transition ${active ? "border-ink bg-ink text-bg" : "border-line text-muted hover:text-ink"}`;

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

  const locale = tmdbLocale(profile.language, profile.country);
  const locales = partner?.country ? [locale, tmdbLocale(partner.language, partner.country)] : [locale];

  return (
    <div className="grid gap-6">
      <ListSync coupleId={profile.couple_id} />
      <div className="grid gap-2">
        <h1 className="font-display text-3xl font-bold tracking-tight">{text.heading}</h1>
        <p className="text-muted">{text.intro}</p>
      </div>

      <section className="grid gap-3" aria-labelledby="pick-time">
        <h2 id="pick-time" className="font-semibold">
          {text.time.label}
        </h2>
        <div className="flex flex-wrap items-center gap-2 text-sm font-semibold">
          {QUICK_MINUTES.map((m) => (
            <Link key={m} href={pickHref(state, { time: String(m), another: 0 })} className={chip(state.time === String(m))}>
              {t.title.runtime(m)}
            </Link>
          ))}
          <Link href={pickHref(state, { time: "late", another: 0 })} className={chip(state.time === "late")}>
            {text.time.late}
          </Link>
        </div>
        <Form action="/pick" className="flex max-w-xs items-end gap-2">
          <label className="grid flex-1 gap-1 text-sm font-semibold">
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
              className="field text-base font-normal"
            />
          </label>
          {state.everything && them && <input type="hidden" name="all" value="1" />}
          <button className="btn-quiet">{text.time.go}</button>
        </Form>
      </section>

      {summary && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="font-semibold">{summary}</p>
          {them && minutes !== null && (
            <Link
              href={pickHref(state, { everything: !state.everything, another: 0 })}
              className={`text-sm font-semibold ${chip(!state.everything)}`}
              aria-pressed={!state.everything}
            >
              <span aria-hidden className={state.everything ? "text-both" : ""}>
                ●{" "}
              </span>
              {text.bothOnly}
            </Link>
          )}
        </div>
      )}

      {minutes !== null && (
        <Suspense key={pickHref(state, {})} fallback={<div aria-busy className="h-80 rounded-xl bg-line/60 motion-safe:animate-pulse" />}>
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
      <div className="card grid justify-items-center gap-2 py-10 text-center">
        <p className="font-semibold">{t.pick.empty.heading(t.title.runtime(minutes))}</p>
        {list.length === 0 && <p className="text-sm text-muted">{t.pick.empty.noList}</p>}
        {failed && <p className="text-sm text-muted">{t.pick.failed}</p>}
        <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-sm font-semibold">
          {!state.everything && (
            <Link href={pickHref(state, { everything: true, another: 0 })} className="text-partner">
              {t.pick.empty.tryEverything}
            </Link>
          )}
          {state.time !== "late" && minutes < MAX_MINUTES && (
            <Link href={pickHref(state, { time: String(Math.min(MAX_MINUTES, minutes + 30)), another: 0 })} className="text-partner">
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

  return (
    // Phones: a small poster beside the details, actions across the bottom. Wider: actions under the details.
    <article className="card grid grid-cols-[7rem_1fr] gap-x-4 gap-y-4 p-4 sm:grid-cols-[200px_1fr] sm:grid-rows-[auto_1fr] sm:gap-x-6 sm:p-5">
      <Link href={titleHref(item)} className="self-start sm:row-span-2">
        <Poster path={item.poster_path} title={item.title} size="fluid" language={language} />
      </Link>
      <div className="grid min-w-0 content-start gap-3">
        {props.wrapped && <p className="text-sm text-muted">{text.wrapped}</p>}
        <div className="grid gap-1">
          <h2 className="font-display text-2xl font-semibold leading-tight">
            <Link href={titleHref(item)} className="hover:underline">
              {item.title}
            </Link>
          </h2>
          <p className="text-sm text-muted">
            {[item.release_date?.slice(0, 4), t.common.mediaType[item.media_type], lengthFor(item, t)].filter(Boolean).join(" · ")}
          </p>
        </div>
        {reason && <p className="text-sm">{reason}</p>}
        <div className="grid justify-items-start gap-1 text-sm">
          <WatchBadge verdict={item.verdict} partnerName={props.partnerName} language={language} />
          {mine && <span className="text-me">{text.services.you(mine)}</span>}
          {theirs && props.partnerName && <span className="text-partner">{text.services.partner(props.partnerName, theirs)}</span>}
        </div>
      </div>
      <div className="col-span-2 grid content-start gap-3 sm:col-span-1 sm:col-start-2">
        <div className="flex flex-wrap items-center gap-2">
          <Link href={titleHref(item)} className="btn">
            {text.watchNow}
          </Link>
          <Link href={`/watch-nights/new?type=${item.media_type}&id=${item.tmdb_id}`} className="btn-quiet">
            {text.planIt}
          </Link>
          <Link href={props.anotherHref} scroll={false} className="btn-quiet">
            {text.another}
          </Link>
          {item.source === "forYou" && <AddButton titleRef={ref} onList={false} language={language} />}
        </div>
        {props.startOverHref && (
          <Link href={props.startOverHref} scroll={false} className="justify-self-start text-sm font-semibold text-muted hover:text-ink">
            {text.startOver}
          </Link>
        )}
      </div>
    </article>
  );
}
