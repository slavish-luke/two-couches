import Link from "next/link";
import type { ReactNode } from "react";
import { Poster } from "@/components/poster";
import type { Messages } from "@/lib/i18n";
import { fitFor, formatDay, formatRelative, formatTime } from "@/lib/night-rules";
import type { WatchNight } from "@/lib/nights";
import { titleHref } from "@/lib/watch";
import { ExternalIcon } from "@/components/icons";
import { Sfx } from "@/components/sfx";
import { TranslatedText } from "@/components/translate";
import { usesOwnFiles } from "@/lib/ready-rules";
import { CommentThread } from "../together/comment-thread";
import { NightAlbum } from "../together/night-album";
import { Countdown } from "./countdown";
import { PrepList } from "./prep-list";
import { ReadyCheck } from "./ready-check";

type Person = { id: string; name: string; timeZone: string };

/**
 * A watch night: what, when on each person's clock, how you'll watch, the note, the ready check, and links
 * to change it or add it to a calendar. `actions` false leaves the ready check and links out (for a night
 * that's over). `className` replaces the card frame (the home page shows it in its spotlight). Each
 * person's time is a ticket on their own clock; `listing` sets them larger with a bigger poster. An upcoming
 * night also has the shared prep list.
 */
export function NightCard(props: {
  night: WatchNight;
  me: Person;
  partner: Person | null;
  now: Date;
  language: string;
  t: Messages;
  actions?: boolean;
  className?: string;
  listing?: boolean;
  /** A live countdown in place of "in 3 days" (Home's next night). */
  live?: boolean;
}) {
  const { night, me, partner, language, t, actions = true, className = "card p-4", listing = false, live = false } = props;
  const start = new Date(night.starts_at);
  const started = start <= props.now;
  const plannedBy =
    night.created_by === me.id
      ? t.nights.plannedByYou
      : partner && night.created_by === partner.id
        ? t.nights.plannedBy(partner.name)
        : null;

  const people = [
    { person: me, fill: "bg-me" },
    ...(partner ? [{ person: partner, fill: "bg-partner" }] : []),
  ];

  // Phones: the poster sits beside the title and tickets; everything after them takes the card's full width.
  return (
    <li
      className={`flex items-start gap-4 max-sm:grid max-sm:grid-cols-[4rem_minmax(0,1fr)] max-sm:gap-x-3 max-sm:gap-y-2 ${className}`}
    >
      <Poster
        path={night.title?.poster_path ?? null}
        title={night.title?.title ?? ""}
        size={listing ? "md" : "sm"}
        language={language}
        className="max-sm:row-span-2 max-sm:w-16"
      />
      <div className="grid min-w-0 flex-1 content-start gap-2 max-sm:contents max-sm:*:col-span-2 max-sm:[&>:nth-child(-n+2)]:col-span-1">
        <div className="flex flex-wrap items-baseline gap-x-2">
          {night.title ? (
            <Link href={titleHref(night.title)} data-item-title className="text-xl font-bold leading-snug hover:underline">
              {night.title.title}
            </Link>
          ) : (
            <span className="text-xl font-bold leading-snug text-muted">{t.nights.noTitle}</span>
          )}
          {actions &&
            (live ? (
              <Countdown startsAt={night.starts_at} serverNow={props.now.getTime()} language={language} />
            ) : (
              <span
                className={
                  started
                    ? "rounded-full border-2 border-outline bg-accent px-2 text-sm font-bold text-on-accent"
                    : "text-sm font-semibold text-muted"
                }
              >
                {started ? t.nights.underWay : formatRelative(start, props.now, language)}
              </span>
            ))}
        </div>

        {/* A ticket per person: their time on their own clock. */}
        <dl className={`grid gap-2.5 ${people.length > 1 ? "grid-cols-2" : ""}`}>
          {people.map(({ person, fill }) => (
            <div
              key={person.id}
              className="paper @container relative grid min-w-0 content-start gap-0.5 rounded-control border-[3px] border-outline px-2.5 pb-1.5 pt-1"
            >
              <dt className="flex min-w-0 items-center gap-1.5 text-xs font-bold">
                <span aria-hidden className={`size-2.5 shrink-0 rounded-full border-2 border-outline ${fill}`} />
                <span className="truncate">{person.name}</span>
              </dt>
              {/* Sized to the ticket too, so "12:46 PM" fits Home's narrow aside. */}
              <dd className={`display-ink whitespace-nowrap leading-none ${listing ? "text-[min(clamp(1.35rem,2.2vw,1.7rem),19cqi)]" : "text-[min(1.5rem,19cqi)]"}`}>
                {formatTime(start, person.timeZone, language)}
              </dd>
              <dd className="text-xs font-semibold text-muted">
                {formatDay(start, person.timeZone, language)}
                {/* A skin's sound effect when it's in this person's sleeping hours (the time already says so). */}
                {fitFor(start, person.timeZone) === "asleep" && <Sfx>{t.nights.sfxAsleep}</Sfx>}
              </dd>
            </div>
          ))}
        </dl>

        <HowLine night={night} t={t} />
        {actions && night.method === "here" && (
          <Link href={`/watch-nights/${night.id}/watch`} className="btn justify-self-start px-3.5 pb-1.5 pt-2 text-base">
            {t.nights.room.open}
          </Link>
        )}
        {night.notes &&
          (night.created_by === me.id ? (
            <p className="whitespace-pre-line text-sm">{night.notes}</p>
          ) : (
            // Sprint 21: the note your partner wrote, in your language if you like.
            <TranslatedText text={night.notes} language={language} className="whitespace-pre-line text-sm" compact />
          ))}

        {actions && (
          <ReadyCheck
            nightId={night.id}
            method={night.method}
            checks={night.checks}
            me={me}
            partner={partner}
            runtime={night.title?.media_type === "movie" ? night.title.runtime : null}
            language={language}
          />
        )}
        {actions && (
          <PrepList
            nightId={night.id}
            items={night.prep}
            method={night.method}
            me={me}
            partner={partner}
            language={language}
          />
        )}
        {/* Sprint 20: the night's photo album (once it has started) and its comment thread, folded away. */}
        <NightAlbum
          nightId={night.id}
          coupleId={night.couple_id}
          photos={night.photos}
          me={me}
          partner={partner}
          language={language}
          serverNow={props.now.getTime()}
          canAdd={started}
        />
        <CommentThread
          target={{ nightId: night.id }}
          comments={night.comments}
          me={me}
          partner={partner}
          language={language}
          serverNow={props.now.getTime()}
          collapsed
        />

        <p className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted">
          {plannedBy && <span>{plannedBy}</span>}
          {actions && (
            <>
              <Link href={`/watch-nights/${night.id}`} className="tap-area font-bold text-ink underline underline-offset-4">
                {t.nights.edit}
              </Link>
              {/* A plain link: the calendar file is a download, not a page to prefetch. */}
              <a href={`/watch-nights/${night.id}/ics`} className="tap-area font-bold text-ink underline underline-offset-4">
                {t.nights.addToCalendar}
              </a>
              {/* Playing your own copies another way? The app's room is there too. */}
              {night.method !== "here" && usesOwnFiles(night.method) && (
                <Link href={`/watch-nights/${night.id}/watch`} className="tap-area font-bold text-ink underline underline-offset-4">
                  {t.nights.room.openShort}
                </Link>
              )}
            </>
          )}
        </p>
      </div>
    </li>
  );
}

/** How you'll watch together, with the Teleparty link or Syncplay room. */
function HowLine({ night, t }: { night: WatchNight; t: Messages }) {
  if (!night.method) return <p className="text-sm text-muted">{t.nights.undecided}</p>;
  const details: ReactNode[] = [];
  if (night.method === "syncplay") {
    if (night.syncplay_server) details.push(t.nights.syncplayServer(night.syncplay_server));
    if (night.syncplay_room) details.push(t.nights.syncplayRoom(night.syncplay_room));
  } else if (night.link) {
    details.push(
      <a key="link" href={night.link} target="_blank" rel="noopener noreferrer" className="tap-area whitespace-nowrap font-semibold text-ink underline">
        {night.method === "teleparty" ? t.nights.openTeleparty : t.nights.openLink} <ExternalIcon className="size-3.5" />
      </a>,
    );
  }
  return (
    <p className="text-sm [overflow-wrap:anywhere]">
      <span className="font-semibold">{t.nights.methods[night.method]}</span>
      {details.map((detail, i) => (
        <span key={i}> · {detail}</span>
      ))}
    </p>
  );
}
