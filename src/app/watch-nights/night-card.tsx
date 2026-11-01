import Link from "next/link";
import type { ReactNode } from "react";
import { Poster } from "@/components/poster";
import type { Messages } from "@/lib/i18n";
import { formatDay, formatRelative, formatTime } from "@/lib/night-rules";
import type { WatchNight } from "@/lib/nights";
import { titleHref } from "@/lib/watch";

type Person = { id: string; name: string; timeZone: string };

/**
 * A watch night: what, when on each person's clock, how you'll watch, the note, and links to change it or
 * add it to a calendar. `actions` false leaves the links out (for a night that's over).
 */
export function NightCard(props: {
  night: WatchNight;
  me: Person;
  partner: Person | null;
  now: Date;
  language: string;
  t: Messages;
  actions?: boolean;
}) {
  const { night, me, partner, language, t, actions = true } = props;
  const start = new Date(night.starts_at);
  const when = (zone: string) => `${formatDay(start, zone, language)}, ${formatTime(start, zone, language)}`;
  const started = start <= props.now;
  const plannedBy =
    night.created_by === me.id
      ? t.nights.plannedByYou
      : partner && night.created_by === partner.id
        ? t.nights.plannedBy(partner.name)
        : null;

  return (
    <li className="card flex gap-4 p-3">
      <Poster path={night.title?.poster_path ?? null} title={night.title?.title ?? ""} size="sm" language={language} />
      <div className="grid min-w-0 content-start gap-1.5">
        <div className="flex flex-wrap items-baseline gap-x-2">
          {night.title ? (
            <Link href={titleHref(night.title)} className="font-display text-lg font-semibold leading-snug hover:underline">
              {night.title.title}
            </Link>
          ) : (
            <span className="font-display text-lg font-semibold leading-snug text-muted">{t.nights.noTitle}</span>
          )}
          {actions && (
            <span className={`text-sm ${started ? "font-semibold text-both" : "text-muted"}`}>
              {started ? t.nights.underWay : formatRelative(start, props.now, language)}
            </span>
          )}
        </div>

        <ul className="grid text-sm font-semibold">
          <li className="text-me">{t.nights.timeFor(t.common.you, when(me.timeZone))}</li>
          {partner && <li className="text-partner">{t.nights.timeFor(partner.name, when(partner.timeZone))}</li>}
        </ul>

        <HowLine night={night} t={t} />
        {night.notes && <p className="whitespace-pre-line text-sm">{night.notes}</p>}

        <p className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
          {plannedBy && <span>{plannedBy}</span>}
          {actions && (
            <>
              <Link href={`/watch-nights/${night.id}`} className="font-semibold text-partner hover:underline">
                {t.nights.edit}
              </Link>
              {/* A plain link: the calendar file is a download, not a page to prefetch. */}
              <a href={`/watch-nights/${night.id}/ics`} className="font-semibold text-partner hover:underline">
                {t.nights.addToCalendar}
              </a>
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
      <a key="link" href={night.link} target="_blank" rel="noopener noreferrer" className="font-semibold text-partner underline">
        {night.method === "teleparty" ? t.nights.openTeleparty : t.nights.openLink}
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
