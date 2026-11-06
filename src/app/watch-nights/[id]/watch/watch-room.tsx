"use client";

import type { RealtimeChannel } from "@supabase/supabase-js";
import { useCallback, useEffect, useRef, useState, type DragEvent, type ReactNode } from "react";
import { Couches } from "@/components/couch";
import { CheckIcon } from "@/components/icons";
import { getMessages } from "@/lib/i18n";
import { compareLengths, formatLength } from "@/lib/ready-rules";
import { clockOffset, correction, decodeSubtitles, roomTopic, targetPosition, toWebVtt, type RoomState } from "@/lib/room-rules";
import { createClient } from "@/lib/supabase/client";

type Person = { id: string; name: string };
type Problem = "unplayable" | "noPicture" | "noSound";
/** What each person shares about themselves while in the room: only their file's length. */
type Presence = { seconds: number | null };
type Notice = { kind: "played" | "paused" | "jumped"; at: number };

/** How often whoever acted last sends where they are, while playing. */
const TICK_MS = 3000;
/** How often to re-measure the other device's clock. */
const PING_MS = 20_000;
/** How long an event we caused ourselves (play, pause, seeked) is waited for, so it isn't sent back. */
const QUIET_MS = 2000;
/** Realtime limits how often one client may update its presence, so a new file length waits this long. */
const PRESENCE_DELAY_MS = 1000;
/** Ticks this soon after your own play, pause or seek are stale (they crossed yours on the way). */
const AFTER_ACTION_MS = 1500;
const VIDEO_TYPES = "video/*,.mkv,.mp4,.m4v,.webm,.mov";
const SUBTITLE_TYPES = ".srt,.vtt";

/**
 * The watch room. You open your own copy of the file: it plays from this device (an object URL) and is
 * never uploaded. Play, pause and seeks go to your partner over a private Realtime broadcast channel
 * (roomTopic()), and whoever acted last sends a tick every few seconds so the other player can nudge its
 * speed or jump to stay in step. Presence shows who's in the room and each file's length.
 */
export function WatchRoom({ nightId, me, partner, language }: { nightId: string; me: Person; partner: Person | null; language: string }) {
  const t = getMessages(language).nights;
  const text = t.room;
  const partnerId = partner?.id ?? null;
  const video = useRef<HTMLVideoElement>(null);
  const channel = useRef<RealtimeChannel | null>(null);
  const [file, setFile] = useState<{ url: string; name: string } | null>(null);
  const [subtitles, setSubtitles] = useState<{ url: string; name: string } | null>(null);
  const [subtitleError, setSubtitleError] = useState(false);
  const [seconds, setSeconds] = useState<number | null>(null);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [status, setStatus] = useState<"connecting" | "live" | "failed">("connecting");
  const [theirs, setTheirs] = useState<Presence | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [blocked, setBlocked] = useState(false);
  const [dragging, setDragging] = useState(false);

  // Sync bookkeeping changes many times a minute and draws nothing, so it lives in refs.
  /** Who acted last: they send the ticks, and only their ticks are followed. */
  const leader = useRef<string | null>(null);
  /** Events our own changes will fire, by type, with when to stop waiting for them. */
  const quiet = useRef<Partial<Record<"play" | "pause" | "seeked", number>>>({});
  /** How far the partner's clock is ahead of ours, from the quickest ping so far. */
  const offset = useRef({ ms: 0, roundTrip: Infinity });
  const lastAction = useRef(0);
  const audioChecked = useRef(false);
  /** The file length last shared in presence. */
  const tracked = useRef<number | null>(null);
  const urls = useRef(new Set<string>());

  const send = useCallback((event: string, payload: Record<string, unknown>) => {
    // Only over the joined socket: while (re)joining, a message is out of date by the time it would land.
    if (channel.current?.state !== "joined") return;
    void channel.current.send({ type: "broadcast", event, payload });
  }, []);

  const stateNow = useCallback(
    (kind: RoomState["kind"]): RoomState | null => {
      const v = video.current;
      if (!v || !v.currentSrc || v.readyState < HTMLMediaElement.HAVE_METADATA) return null;
      return { kind, playing: !v.paused, position: v.currentTime, at: Date.now(), by: me.id };
    },
    [me.id],
  );

  /** Follow the partner's player. */
  const apply = useCallback(
    (state: RoomState) => {
      const v = video.current;
      if (!v || !v.currentSrc || v.readyState < HTMLMediaElement.HAVE_METADATA) return;
      if (state.kind === "tick") {
        if (state.by !== leader.current || Date.now() - lastAction.current < AFTER_ACTION_MS) return;
      } else {
        leader.current = state.by;
      }
      if (state.kind === "play" || state.kind === "pause" || state.kind === "seek") {
        setNotice({ kind: state.kind === "play" ? "played" : state.kind === "pause" ? "paused" : "jumped", at: state.position });
      }

      const end = Number.isFinite(v.duration) ? v.duration : Infinity;
      const target = Math.min(targetPosition(state, Date.now(), offset.current.ms), end);
      const drift = v.currentTime - target;
      const seek = () => {
        quiet.current.seeked = Date.now() + QUIET_MS;
        v.currentTime = target;
      };
      if (state.kind === "tick" && state.playing && !v.paused) {
        const fix = correction(drift, TICK_MS / 1000);
        if ("seek" in fix) seek();
        else v.playbackRate = fix.rate;
      } else {
        if (Math.abs(drift) > 0.25) seek();
        v.playbackRate = 1;
      }

      if (state.playing && v.paused) {
        quiet.current.play = Date.now() + QUIET_MS;
        v.play().then(
          () => setBlocked(false),
          () => {
            // Browsers can refuse to play with sound until this page has had a tap.
            delete quiet.current.play;
            setBlocked(true);
          },
        );
      } else if (!state.playing && !v.paused) {
        quiet.current.pause = Date.now() + QUIET_MS;
        v.pause();
      }
    },
    [],
  );

  // Join the room.
  useEffect(() => {
    const supabase = createClient();
    const ch = supabase.channel(roomTopic(nightId), {
      config: { private: true, broadcast: { self: false }, presence: { key: me.id, enabled: true } },
    });
    ch.on("broadcast", { event: "state" }, ({ payload }) => apply(payload as RoomState));
    // Someone came in or opened their file: tell them where we are.
    ch.on("broadcast", { event: "hello" }, () => {
      const state = stateNow("sync");
      if (!state) return;
      if (state.playing && !leader.current) leader.current = me.id;
      send("state", state);
    });
    ch.on("broadcast", { event: "ping" }, ({ payload }) => {
      send("pong", { sentAt: payload.sentAt, theirs: Date.now(), to: payload.from });
    });
    ch.on("broadcast", { event: "pong" }, ({ payload }) => {
      if (payload.to !== me.id) return;
      const sample = clockOffset(payload.sentAt, payload.theirs, Date.now());
      if (sample.roundTrip <= offset.current.roundTrip) offset.current = { ms: sample.offset, roundTrip: sample.roundTrip };
    });
    ch.on("presence", { event: "sync" }, () => {
      const entry = partnerId ? ch.presenceState<Presence>()[partnerId]?.[0] : undefined;
      setTheirs(entry ? { seconds: entry.seconds ?? null } : null);
    });
    channel.current = ch;

    let cancelled = false;
    // Private channels check the token against the room's policies, so join as the signed-in user.
    supabase.auth.getSession().then(async ({ data }) => {
      if (cancelled) return;
      await supabase.realtime.setAuth(data.session?.access_token ?? null);
      if (cancelled) return;
      ch.subscribe(async (state) => {
        if (state === "SUBSCRIBED") {
          setStatus("live");
          await ch.track({ seconds: tracked.current });
          send("ping", { sentAt: Date.now(), from: me.id });
          send("hello", {});
        } else if (!cancelled) {
          // CHANNEL_ERROR, TIMED_OUT or CLOSED: the client keeps retrying, and SUBSCRIBED sets it back.
          setStatus("failed");
        }
      });
    });

    const ping = setInterval(() => send("ping", { sentAt: Date.now(), from: me.id }), PING_MS);
    const tick = setInterval(() => {
      if (leader.current !== me.id || video.current?.paused !== false) return;
      const state = stateNow("tick");
      if (state) send("state", state);
    }, TICK_MS);

    return () => {
      cancelled = true;
      clearInterval(ping);
      clearInterval(tick);
      channel.current = null;
      void supabase.removeChannel(ch);
    };
  }, [nightId, me.id, partnerId, apply, send, stateNow]);

  // Share your file's length while you're in the room: once it's known, and not more than once a second.
  useEffect(() => {
    if (status !== "live" || seconds === null || seconds === tracked.current) return;
    const id = setTimeout(() => {
      tracked.current = seconds;
      void channel.current?.track({ seconds });
    }, PRESENCE_DELAY_MS);
    return () => clearTimeout(id);
  }, [seconds, status]);

  // A partner's action shows for a few seconds.
  useEffect(() => {
    if (!notice) return;
    const id = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(id);
  }, [notice]);

  // Let go of the files when leaving.
  useEffect(() => {
    const held = urls.current;
    return () => held.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  function hold(blob: Blob) {
    const url = URL.createObjectURL(blob);
    urls.current.add(url);
    return url;
  }

  function release(url: string | undefined) {
    if (!url) return;
    URL.revokeObjectURL(url);
    urls.current.delete(url);
  }

  function openFile(f: File) {
    release(file?.url);
    setProblem(null);
    setSeconds(null);
    setBlocked(false);
    audioChecked.current = false;
    setFile({ url: hold(f), name: f.name });
  }

  async function openSubtitles(f: File) {
    setSubtitleError(false);
    try {
      const vtt = toWebVtt(decodeSubtitles(await f.arrayBuffer()));
      if (!vtt.includes("-->")) throw new Error("No cues");
      release(subtitles?.url);
      setSubtitles({ url: hold(new Blob([vtt], { type: "text/vtt" })), name: f.name });
    } catch {
      setSubtitleError(true);
    }
  }

  function removeSubtitles() {
    release(subtitles?.url);
    setSubtitles(null);
  }

  function openAny(f: File) {
    if (/\.(srt|vtt)$/i.test(f.name)) void openSubtitles(f);
    else openFile(f);
  }

  /** Your own play, pause or seek: tell your partner, unless it was us following theirs. */
  function onLocal(type: "play" | "pause" | "seeked") {
    const until = quiet.current[type];
    if (until !== undefined) {
      delete quiet.current[type];
      if (Date.now() < until) return;
    }
    const state = stateNow(type === "seeked" ? "seek" : type);
    if (!state) return;
    leader.current = me.id;
    lastAction.current = Date.now();
    if (video.current) video.current.playbackRate = 1;
    if (type === "play") setBlocked(false);
    send("state", state);
  }

  function onLoaded() {
    const v = video.current;
    if (!v) return;
    if (Number.isFinite(v.duration)) setSeconds(Math.round(v.duration));
    // Sound with no picture: the browser can't decode this file's video (e.g. HEVC without hardware support).
    if (v.videoWidth === 0) setProblem("noPicture");
    // Safari lists the audio tracks it can play.
    const audio = (v as HTMLVideoElement & { audioTracks?: { length: number } }).audioTracks;
    if (audio && audio.length === 0) setProblem((p) => p ?? "noSound");
    // Ask where your partner is, now that there's something to follow with.
    send("hello", {});
  }

  function onTimeUpdate() {
    const v = video.current as (HTMLVideoElement & { webkitAudioDecodedByteCount?: number; mozHasAudio?: boolean }) | null;
    if (!v || audioChecked.current || v.currentTime < 2) return;
    audioChecked.current = true;
    // Chrome and Edge play a file whose sound they can't decode (AC3, DTS) silently; say so.
    if (v.webkitAudioDecodedByteCount === 0 || v.mozHasAudio === false) setProblem((p) => p ?? "noSound");
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) openAny(f);
  }

  const lengths = compareLengths(seconds, theirs?.seconds ?? null);
  const noticeText =
    notice && partner
      ? notice.kind === "played"
        ? text.played(partner.name)
        : notice.kind === "paused"
          ? text.paused(partner.name)
          : text.jumped(partner.name, formatLength(Math.round(notice.at)))
      : null;

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
      <div
        className="grid gap-3"
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        {file ? (
          <>
            {/* Native controls: they work with the keyboard, in fullscreen and on phones. */}
            <video
              ref={video}
              src={file.url}
              controls
              playsInline
              preload="auto"
              className="aspect-video w-full rounded-panel border-[3px] border-outline bg-black"
              onLoadedMetadata={onLoaded}
              onError={() => setProblem("unplayable")}
              onTimeUpdate={onTimeUpdate}
              onPlay={() => onLocal("play")}
              onPause={() => onLocal("pause")}
              onSeeked={() => onLocal("seeked")}
            >
              {subtitles && (
                <track
                  key={subtitles.url}
                  kind="subtitles"
                  src={subtitles.url}
                  srcLang={language}
                  label={subtitles.name}
                  default
                  // `default` isn't enough for a track added after the video loaded: switch it on.
                  ref={(el) => {
                    if (el) el.track.mode = "showing";
                  }}
                />
              )}
            </video>

            {blocked && (
              <div className="paper grid justify-items-start gap-2 rounded-control border-[3px] border-outline p-3">
                <button type="button" className="btn" onClick={() => void video.current?.play()}>
                  {text.joinIn}
                </button>
                <p className="text-sm text-muted">{text.joinNote}</p>
              </div>
            )}
            {problem && (
              <p role="alert" className="paper rounded-control border-[3px] border-outline p-3 font-semibold text-danger">
                {text.problems[problem]}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <FilePick accept={VIDEO_TYPES} onFile={openFile} className="btn-quiet">
                {text.change}
              </FilePick>
              <FilePick accept={SUBTITLE_TYPES} onFile={(f) => void openSubtitles(f)} className="btn-quiet">
                {text.subtitles}
              </FilePick>
              {subtitles ? (
                <button type="button" onClick={removeSubtitles} className="tap-area text-sm font-bold underline underline-offset-4">
                  {text.removeSubtitles}
                </button>
              ) : (
                <span className="text-sm text-muted">{text.subtitlesNote}</span>
              )}
            </div>
            {subtitleError && (
              <p role="alert" className="text-sm font-semibold text-danger">
                {text.subtitlesFailed}
              </p>
            )}
          </>
        ) : (
          <div
            className={`card grid min-h-72 content-center justify-items-center gap-3 p-6 text-center sm:aspect-video ${dragging ? "bg-accent-soft" : ""}`}
          >
            <Couches size={56} />
            <p className="max-w-[30rem] font-medium">{text.intro}</p>
            <FilePick accept={VIDEO_TYPES} onFile={openFile} className="btn">
              {text.choose}
            </FilePick>
            <p className="text-sm text-muted max-sm:hidden">{text.drop}</p>
            <p className="max-w-[30rem] text-sm font-semibold">{text.stays}</p>
            <p className="max-w-[30rem] text-sm text-muted">{text.works}</p>
          </div>
        )}
      </div>

      <aside className="card grid gap-3 p-4 text-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-bold">{text.people}</h2>
          {status === "connecting" && <span className="font-semibold text-muted">{text.connecting}</span>}
        </div>
        <ul className="grid gap-2">
          <PersonRow person={me} fill="bg-me" here seconds={seconds} language={language} />
          {partner && <PersonRow person={partner} fill="bg-partner" here={theirs !== null} seconds={theirs?.seconds ?? null} language={language} />}
        </ul>
        {lengths &&
          (lengths.same ? (
            <p className="flex items-start gap-2 font-semibold">
              <span aria-hidden className="mt-px grid size-5 shrink-0 place-items-center rounded-full border-2 border-outline bg-accent text-on-accent">
                <CheckIcon className="size-3 [stroke-width:3.5]" />
              </span>
              {t.ready.sameLength(formatLength(seconds!))}
            </p>
          ) : (
            <p className="font-semibold text-danger">{t.ready.lengthsDiffer(formatLength(lengths.difference))}</p>
          ))}
        {status === "failed" && (
          <p role="alert" className="font-semibold text-danger">
            {text.failed}
          </p>
        )}
        <p aria-live="polite" className="min-h-5 font-semibold">
          {noticeText}
        </p>
      </aside>
    </div>
  );
}

/** One person in the room: their name tag, whether they're here, and their file's length. */
function PersonRow(props: { person: Person; fill: string; here: boolean; seconds: number | null; language: string }) {
  const text = getMessages(props.language).nights.room;
  return (
    <li className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
      <span className={`max-w-full truncate rounded-full border-[2.5px] border-outline px-2.5 font-bold ${props.fill}`}>{props.person.name}</span>
      <span className={props.here ? "font-semibold" : "text-muted"}>{props.here ? text.here : text.away}</span>
      {props.here && <span className="text-muted tabular-nums">{props.seconds ? text.length(formatLength(props.seconds)) : text.noFile}</span>}
    </li>
  );
}

/** A button-styled label around a hidden file input. Picking a file never uploads it. */
function FilePick(props: { accept: string; onFile: (file: File) => void; className: string; children: ReactNode }) {
  return (
    <label className={`${props.className} cursor-pointer has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-outline`}>
      <input
        type="file"
        accept={props.accept}
        className="sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) props.onFile(f);
          // Picking the same file again should still count.
          e.target.value = "";
        }}
      />
      {props.children}
    </label>
  );
}
