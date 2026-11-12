"use client";

import { NextEpisodeIcon } from "@/components/icons";
import { getMessages } from "@/lib/i18n";

/**
 * On a series night, once an episode ends (or "Next episode" is pressed): move on to the next one. It
 * moves the list's progress on for both of you, and both screens then wait for each of you to open the
 * next file. After the last episode it only saves the progress. Inside the room's stage, so it shows in
 * full screen too.
 */
export function RoomNext(props: {
  language: string;
  /** The episode just watched and the next one, e.g. "S2 E5" and "S2 E6" (null after the last). */
  ended: string;
  next: string | null;
  moving: boolean;
  error?: string;
  onMoveOn: () => void;
  onClose: () => void;
}) {
  const text = getMessages(props.language).nights.room.next;
  return (
    <section data-room-next aria-labelledby="room-next" className="card grid gap-3 p-4 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center sm:gap-x-4">
      <span aria-hidden className="grid size-12 place-items-center rounded-full border-[3px] border-outline bg-accent text-on-accent max-sm:hidden">
        <NextEpisodeIcon className="size-6" />
      </span>
      <div className="grid gap-3">
        <div className="grid gap-0.5">
          <p className="text-sm font-semibold text-muted">{text.ended(props.ended)}</p>
          <h2 id="room-next" className="display-ink text-2xl">
            {props.next ? text.heading(props.next) : text.lastHeading}
          </h2>
          <p className="font-medium">{props.next ? text.note : text.lastNote}</p>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <button type="button" className="btn" disabled={props.moving} onClick={props.onMoveOn}>
            {props.moving ? text.moving : props.next ? text.moveOn(props.next) : text.saveLast}
          </button>
          <button type="button" onClick={props.onClose} className="tap-area text-sm font-bold underline underline-offset-4">
            {text.notNow}
          </button>
        </div>
        {props.error && (
          <p role="alert" className="font-semibold text-danger">
            {props.error}
          </p>
        )}
      </div>
    </section>
  );
}
