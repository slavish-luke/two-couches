"use client";

import type { RealtimeChannel } from "@supabase/supabase-js";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type DragEvent, type ReactNode } from "react";
import { Couches } from "@/components/couch";
import { FilePick, VIDEO_TYPES } from "@/components/file-pick";
import { ChatIcon, CheckIcon, FullscreenIcon, ReactionSticker } from "@/components/icons";
import { getMessages } from "@/lib/i18n";
import { problemOnLoad, silentWhilePlaying, SOUND_CHECK_AFTER_S, type MediaProblem } from "@/lib/media-check";
import { dateLocale } from "@/lib/places";
import { compareLengths, formatLength } from "@/lib/ready-rules";
import { episodeAfter, type Progress } from "@/lib/list-rules";
import {
  allowSend,
  atEnd,
  BUFFERING_AFTER_MS,
  BUFFERING_TTL_MS,
  CHAT_KEPT,
  CHAT_LIMIT,
  cleanChat,
  clockOffset,
  compareFiles,
  correction,
  decodeSubtitles,
  EPISODE_LIMIT,
  formatSize,
  HASH_CHUNK,
  isLaterEpisode,
  isReaction,
  MAX_FLOATING,
  NO_FILE,
  NOT_WAITING,
  NUDGE_AT_S,
  openSubtitlesHash,
  partnerBuffering,
  REACTION_LIMIT,
  REACTIONS,
  readEpisodeEvent,
  readFileInfo,
  rejoinDelay,
  roomTopic,
  sameEpisode,
  sameFileInfo,
  targetPosition,
  tickUsable,
  toWebVtt,
  waitAfterAction,
  waitReason,
  waitStep,
  type EpisodeEvent,
  type FileInfo,
  type Reaction,
  type RoomState,
  type Wait,
  type WaitReason,
} from "@/lib/room-rules";
import { createClient } from "@/lib/supabase/client";
import { finishEpisode } from "./actions";
import { RoomChat, type ChatMessage } from "./room-chat";
import { RoomNext } from "./room-next";
import { RoomOverlay, type Burst } from "./room-overlay";
import { SubtitleFinder } from "./subtitle-finder";

type Person = { id: string; name: string };
type Problem = MediaProblem;
/** A short message over the video about something your partner did (or said, while the chat is hidden). */
type ToastItem =
  | { kind: "played" | "paused" | "joined" | "left" }
  | { kind: "jumped"; at: number }
  | { kind: "said"; message: string }
  | { kind: "movedOn"; episode: Progress | null };
type Toast = ToastItem & { id: number };

/**
 * How often whoever acted last sends where they are (about 150 bytes each), paused too, so a pause that
 * got lost on a bad connection still reaches the other screen.
 */
const TICK_MS = 3000;
/** How often to re-measure the other device's clock, after a quick burst of PING_BURST pings on joining. */
const PING_MS = 20_000;
const PING_BURST = 5;
const PING_BURST_MS = 1500;
/** How long an event we caused ourselves (play, pause, seeked) is waited for, so it isn't sent back. */
const QUIET_MS = 2000;
/** Realtime limits how often one client may update its presence: at most one update this often. */
const PRESENCE_DELAY_MS = 1000;
/** How long a message over the video stays (a chat line a little longer, to read it). */
const TOAST_MS = 4000;
const SAID_MS = 6000;
/** A partner who leaves and is back within this long (a reconnection) isn't announced. */
const LEFT_AFTER_MS = 4000;
/** Reactions coming in faster than this are dropped, whatever the other screen sends. */
const INCOMING_REACTIONS = { max: 12, windowMs: 3000 };
const SUBTITLE_TYPES = ".srt,.vtt";

function subscribeFullscreen(onChange: () => void) {
  document.addEventListener("fullscreenchange", onChange);
  return () => document.removeEventListener("fullscreenchange", onChange);
}
const noSubscribe = () => () => {};

/**
 * The watch room. You open your own copy of the file: it plays from this device (an object URL) and is
 * never uploaded. Play, pause and seeks go to your partner over a private Realtime broadcast channel
 * (roomTopic()), and whoever acted last sends a tick every few seconds so the other player can nudge its
 * speed or jump to stay in step. Presence shows who's in the room and each file's length, name and size.
 * The same channel carries the chat and reactions, and holds playback while one of you isn't ready
 * (waitStep()). Nothing is stored.
 */
export function WatchRoom({
  nightId,
  me,
  partner,
  language,
  finder,
  series,
}: {
  nightId: string;
  me: Person;
  partner: Person | null;
  language: string;
  /** Finding subtitles online: off until OpenSubtitles is set up; for a series, the episode to start from. */
  finder: { enabled: boolean; episode: Progress | null };
  /**
   * A series night whose series is on the list (Sprint 23): the episode up next on the list, played first,
   * and TMDB's episodes per season, to roll over into the next season. Null for films and anything else.
   */
  series: { playing: Progress; seasonEpisodes: number[] | null } | null;
}) {
  const t = getMessages(language).nights;
  const text = t.room;
  const partnerId = partner?.id ?? null;
  const partnerName = partner?.name ?? getMessages(language).common.yourPartner;
  const video = useRef<HTMLVideoElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const channel = useRef<RealtimeChannel | null>(null);
  const [file, setFile] = useState<{ url: string; name: string; size: number } | null>(null);
  const [subtitles, setSubtitles] = useState<{ url: string; name: string } | null>(null);
  const [subtitleError, setSubtitleError] = useState(false);
  const [seconds, setSeconds] = useState<number | null>(null);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [status, setStatus] = useState<"connecting" | "live" | "failed">("connecting");
  /** The partner's file, as shared in presence; null while they aren't in the room. */
  const [theirs, setTheirs] = useState<FileInfo | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [bursts, setBursts] = useState<Burst[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [chatOpen, setChatOpen] = useState(true);
  /** The chat beside the picture in full screen. */
  const [screenChat, setScreenChat] = useState(false);
  const [unread, setUnread] = useState(0);
  /** Our wait for the partner, as drawn: why, and whether we paused for it. */
  const [waitView, setWaitView] = useState<{ reason: WaitReason | null; holding: boolean }>({ reason: null, holding: false });
  /** The partner paused both screens to wait for us (reason as they sent it). */
  const [heldBy, setHeldBy] = useState<{ reason: WaitReason; at: number } | null>(null);
  const [blocked, setBlocked] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [finding, setFinding] = useState(false);
  /** Your file's OpenSubtitles hash, for subtitles timed to it. Worked out from its two ends, in the browser. */
  const [hash, setHash] = useState<string | null>(null);
  /** The latest round trip to the partner's screen (ms), shown so a slow connection is visible. */
  const [delay, setDelay] = useState<number | null>(null);
  const fullscreen = useSyncExternalStore(
    subscribeFullscreen,
    () => document.fullscreenElement?.hasAttribute("data-room-stage") ?? false,
    () => false,
  );
  // iPhones can only put the <video> itself full screen (its own controls then; no reactions over it).
  const canFullscreen = useSyncExternalStore(noSubscribe, () => document.fullscreenEnabled, () => false);

  // Sync bookkeeping changes many times a minute and draws nothing, so it lives in refs.
  /** Who acted last: they send the ticks, and only their ticks are followed. */
  const leader = useRef<string | null>(null);
  /** Events our own changes will fire, by type, with when to stop waiting for them. */
  const quiet = useRef<Partial<Record<"play" | "pause" | "seeked", number>>>({});
  /** How far the partner's clock is ahead of ours, from the quickest ping so far. */
  const offset = useRef({ ms: 0, roundTrip: Infinity });
  const lastAction = useRef(0);
  /** Whether the last tick found us more than SEEK_AT_S apart: a jump needs two in a row. */
  const far = useRef(false);
  const audioChecked = useRef(false);
  /** The file info last shared in presence, and when. */
  const tracked = useRef<FileInfo>(NO_FILE);
  const trackedAt = useRef(0);
  const urls = useRef(new Set<string>());
  /** The partner's presence (null: not in the room) and their last buffering report. */
  const partnerFile = useRef<FileInfo | null>(null);
  const partnerBuffer = useRef<{ buffering: boolean; at: number } | null>(null);
  /** Waiting for the partner (waitStep()), and why, for the repeated hold message. */
  const wait = useRef<Wait>(NOT_WAITING);
  const waitWhy = useRef<WaitReason | null>(null);
  /** Our own player: stuck long enough to tell the partner (BUFFERING_AFTER_MS). */
  const buffering = useRef(false);
  const bufferTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const sentChat = useRef<number[]>([]);
  const sentReactions = useRef<number[]>([]);
  const gotReactions = useRef<number[]>([]);
  const nextId = useRef(0);
  /** Whether the chat is on screen now, for counting unread messages. */
  const chatShown = useRef(true);

  // The next episode (Sprint 23): which one is playing, the offer once it ends, and moving on together.
  const [episode, setEpisode] = useState<Progress | null>(series?.playing ?? null);
  const [offer, setOffer] = useState(false);
  const [moving, setMoving] = useState(false);
  const [nextError, setNextError] = useState<string>();
  /** Moved on in this visit (the drop-in card then names the episode), or past the last one. */
  const [movedOn, setMovedOn] = useState(false);
  const [allDone, setAllDone] = useState(false);
  const episodeNow = useRef(episode);
  /** The last move on we made or followed, said again to a partner who (re)joins in case they missed it. */
  const lastMove = useRef<EpisodeEvent | null>(null);
  const sentMoves = useRef<number[]>([]);
  const gotMoves = useRef<number[]>([]);
  /** The latest `episode` handler, for the channel (which is set up once per join). */
  const onEpisode = useRef<(payload: unknown) => void>(() => {});

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

  const toast = useCallback((item: ToastItem) => {
    const id = (nextId.current += 1);
    setToasts((all) => [...all.slice(-2), { ...item, id }]);
    setTimeout(() => setToasts((all) => all.filter((x) => x.id !== id)), item.kind === "said" ? SAID_MS : TOAST_MS);
  }, []);

  const float = useCallback((kind: Reaction, mine: boolean) => {
    const id = (nextId.current += 1);
    const burst = { id, kind, mine, x: 12 + Math.random() * 76, sway: Math.round((Math.random() - 0.5) * 48) };
    setBursts((all) => (all.length >= MAX_FLOATING ? all : [...all, burst]));
    // In case the animation never ends (a hidden tab doesn't run them).
    setTimeout(() => setBursts((all) => all.filter((b) => b.id !== id)), 4000);
  }, []);

  /** Why we'd wait for the partner now (see waitReason()). */
  const reasonNow = useCallback(() => {
    if (!partnerId) return null;
    const p = partnerFile.current;
    const readiness = p && { here: true, hasFile: p.seconds !== null, buffering: partnerBuffering(partnerBuffer.current, Date.now()) };
    return waitReason(readiness, wait.current.holding);
  }, [partnerId]);

  /** Pause both screens to wait for the partner. Sent again with every tick while it lasts. */
  const holdNow = useCallback(
    (reason: WaitReason) => {
      const v = video.current;
      if (!v) return;
      if (!v.paused) {
        quiet.current.pause = Date.now() + QUIET_MS;
        v.pause();
      }
      v.playbackRate = 1;
      // Ticks the other screen sent before this are out of date now.
      lastAction.current = Date.now();
      const state = stateNow("pause");
      if (state) send("state", { ...state, playing: false, auto: true, wait: reason });
    },
    [send, stateNow],
  );

  /** The partner is ready: play again, on both screens, since it was our wait that paused them. */
  const resumeNow = useCallback(() => {
    const v = video.current;
    if (!v || !v.paused) return;
    quiet.current.play = Date.now() + QUIET_MS;
    v.play().then(
      () => setBlocked(false),
      () => {
        delete quiet.current.play;
        setBlocked(true);
      },
    );
    lastAction.current = Date.now();
    const state = stateNow("play");
    if (state) send("state", { ...state, playing: true, auto: true });
  }, [send, stateNow]);

  /** Hold or resume as waitStep() says, after anything that changes who's ready or whether we play. */
  const evaluate = useCallback(() => {
    const v = video.current;
    if (!v || !v.currentSrc || v.readyState < HTMLMediaElement.HAVE_METADATA) {
      wait.current = NOT_WAITING;
      waitWhy.current = null;
      setWaitView((w) => (w.reason === null && !w.holding ? w : { reason: null, holding: false }));
      return;
    }
    const reason = reasonNow();
    const step = waitStep(wait.current, reason, !v.paused);
    wait.current = step.wait;
    waitWhy.current = reason;
    if (step.action === "hold" && reason) holdNow(reason);
    else if (step.action === "resume") resumeNow();
    const holding = step.wait.holding;
    setWaitView((w) => (w.reason === reason && w.holding === holding ? w : { reason, holding }));
  }, [holdNow, reasonNow, resumeNow]);

  /** Follow the partner's player. */
  const apply = useCallback(
    (state: RoomState) => {
      const deliberate = !state.auto && (state.kind === "play" || state.kind === "pause" || state.kind === "seek");
      if (state.auto) {
        const reason: WaitReason = state.wait === "noFile" || state.wait === "away" ? state.wait : "buffering";
        setHeldBy(state.kind === "pause" ? { reason, at: Date.now() } : null);
      } else if (deliberate) {
        // A seek doesn't end a wait: they're still waiting for us.
        if (state.kind !== "seek") setHeldBy(null);
        // Their play during our wait means "play anyway"; their pause ends our wait for good.
        wait.current = waitAfterAction(wait.current, state.kind as "play" | "pause" | "seek");
        if (partnerId) {
          if (state.kind === "seek") toast({ kind: "jumped", at: state.position });
          else toast({ kind: state.kind === "play" ? "played" : "paused" });
        }
      }

      const v = video.current;
      if (!v || !v.currentSrc || v.readyState < HTMLMediaElement.HAVE_METADATA) return;
      if (state.kind === "tick") {
        // Only the leader's, only once the clocks are compared, and not late or older than our own action.
        if (state.by !== leader.current || offset.current.roundTrip === Infinity) return;
        if (!tickUsable(state, Date.now(), offset.current.ms, lastAction.current)) return;
      } else if (
        state.kind === "sync" &&
        leader.current === me.id &&
        lastAction.current > 0 &&
        lastAction.current > (state.actedAt ?? 0) - offset.current.ms
      ) {
        // Back from a disconnection, both of us think we're in charge: we acted last, so they follow us.
        const mine = stateNow("sync");
        if (mine) send("state", { ...mine, actedAt: lastAction.current });
        return;
      } else if (!state.auto) {
        // A wait's pause and resume are followed without changing who's in charge.
        leader.current = state.by;
        far.current = false;
      }

      const end = Number.isFinite(v.duration) ? v.duration : Infinity;
      const target = Math.min(targetPosition(state, Date.now(), offset.current.ms), end);
      const drift = v.currentTime - target;
      const seek = () => {
        quiet.current.seeked = Date.now() + QUIET_MS;
        v.currentTime = target;
      };
      if (state.kind === "tick" && state.playing && !v.paused) {
        const fix = correction(drift, TICK_MS / 1000, far.current);
        if ("seek" in fix) {
          far.current = false;
          seek();
        } else {
          far.current = fix.far;
          v.playbackRate = fix.rate;
        }
      } else {
        far.current = false;
        if (Math.abs(drift) > NUDGE_AT_S) seek();
        v.playbackRate = 1;
      }

      // While we hold for the partner, only a deliberate play (play anyway) starts us again.
      if (state.playing && v.paused && !wait.current.holding) {
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
      evaluate();
    },
    [me.id, partnerId, send, stateNow, toast, evaluate],
  );

  /** Tell the partner whether our player is stuck (repeated while it is, so a lost "unstuck" expires). */
  const reportBuffering = useCallback(
    (now: boolean) => {
      if (now === buffering.current) return;
      buffering.current = now;
      send("status", { by: me.id, buffering: now });
    },
    [me.id, send],
  );

  // Join the room, and join again whenever the channel closes. The client rejoins by itself after errors
  // and timeouts, but not when the server closes the channel because its access token ran out (the token's
  // renewal never got through on a bad connection, and an hour later the room went dead). So each attempt
  // starts with a fresh session: getSession() renews an expired token.
  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;
    let current: RealtimeChannel | null = null;
    let busy = false;
    let attempt = 0;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let pingsLeft = 0;
    let lastPing = 0;
    /** Whether the partner was in the room at the last presence sync (undefined: not known yet). */
    let partnerHere: boolean | undefined;
    let leftTimer: ReturnType<typeof setTimeout> | undefined;

    const ping = () => {
      lastPing = Date.now();
      send("ping", { sentAt: lastPing, from: me.id });
    };

    // Just (re)joined: measure the clocks quickly, and whoever's in charge says where they are; anyone
    // else asks. (Asking made the one in charge follow a screen that had missed their pause.)
    const greet = () => {
      ping();
      pingsLeft = PING_BURST - 1;
      if (lastMove.current) send("episode", { ...lastMove.current, by: me.id });
      const mine = leader.current === me.id ? stateNow("sync") : null;
      if (mine) send("state", { ...mine, actedAt: lastAction.current });
      else send("hello", {});
      if (buffering.current) send("status", { by: me.id, buffering: true });
    };

    const later = () => {
      if (cancelled || retry !== undefined) return;
      retry = setTimeout(() => {
        retry = undefined;
        attempt += 1;
        void reopen();
      }, rejoinDelay(attempt));
    };

    const open = async () => {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      // Private channels check the token against the room's policies, so join as the signed-in user.
      await supabase.realtime.setAuth(data.session?.access_token ?? null);
      if (cancelled) return;

      const ch = supabase.channel(roomTopic(nightId), {
        config: { private: true, broadcast: { self: false }, presence: { key: me.id, enabled: true } },
      });
      ch.on("broadcast", { event: "state" }, ({ payload }) => apply(payload as RoomState));
      // Someone came in, came back or opened their file: tell them where we are. They'll follow us.
      ch.on("broadcast", { event: "hello" }, () => {
        // Which episode we're on first, in case they missed us moving on (it only ever moves forward).
        if (lastMove.current) send("episode", { ...lastMove.current, by: me.id });
        const state = stateNow("sync");
        if (!state) return;
        leader.current = me.id;
        send("state", { ...state, actedAt: lastAction.current });
      });
      ch.on("broadcast", { event: "ping" }, ({ payload }) => {
        send("pong", { sentAt: payload.sentAt, theirs: Date.now(), to: payload.from });
      });
      ch.on("broadcast", { event: "pong" }, ({ payload }) => {
        if (payload.to !== me.id) return;
        const sample = clockOffset(payload.sentAt, payload.theirs, Date.now());
        setDelay(sample.roundTrip);
        if (sample.roundTrip <= offset.current.roundTrip) offset.current = { ms: sample.offset, roundTrip: sample.roundTrip };
      });
      // The partner's player is stuck (or not any more).
      ch.on("broadcast", { event: "status" }, ({ payload }) => {
        if (!partnerId || payload.by !== partnerId) return;
        partnerBuffer.current = { buffering: payload.buffering === true, at: Date.now() };
        evaluate();
      });
      ch.on("broadcast", { event: "chat" }, ({ payload }) => {
        if (!partnerId || payload.by !== partnerId || typeof payload.text !== "string") return;
        const message = cleanChat(payload.text);
        if (!message) return;
        const id = typeof payload.id === "string" ? payload.id.slice(0, 64) : `${Date.now()}`;
        setMessages((all) => (all.some((m) => m.id === id) ? all : [...all.slice(-(CHAT_KEPT - 1)), { id, by: partnerId, text: message, at: Date.now() }]));
        if (!chatShown.current) {
          setUnread((n) => n + 1);
          toast({ kind: "said", message });
        }
      });
      // The partner moved on to the next episode (Sprint 23).
      ch.on("broadcast", { event: "episode" }, ({ payload }) => onEpisode.current(payload));
      ch.on("broadcast", { event: "react" }, ({ payload }) => {
        if (!partnerId || payload.by !== partnerId || !isReaction(payload.kind)) return;
        const allowed = allowSend(gotReactions.current, Date.now(), INCOMING_REACTIONS);
        gotReactions.current = allowed.sent;
        if (allowed.ok) float(payload.kind, false);
      });
      ch.on("presence", { event: "sync" }, () => {
        const entry = partnerId ? ch.presenceState()[partnerId]?.[0] : undefined;
        const info = entry ? readFileInfo(entry) : null;
        partnerFile.current = info;
        setTheirs((old) => (info === null ? null : sameFileInfo(old, info) ? old : info));
        const here = info !== null;
        if (!here) partnerBuffer.current = null;
        // Announce comings and goings, but not a quick reconnection, and not who was here when we came.
        if (partnerHere !== undefined && here !== partnerHere) {
          if (here) {
            if (leftTimer !== undefined) {
              clearTimeout(leftTimer);
              leftTimer = undefined;
            } else toast({ kind: "joined" });
          } else {
            leftTimer = setTimeout(() => {
              leftTimer = undefined;
              toast({ kind: "left" });
            }, LEFT_AFTER_MS);
          }
        }
        partnerHere = here;
        evaluate();
      });
      current = ch;
      channel.current = ch;

      try {
        ch.subscribe(async (state) => {
          if (cancelled || current !== ch) return;
          if (state === "SUBSCRIBED") {
            attempt = 0;
            clearTimeout(retry);
            retry = undefined;
            trackedAt.current = Date.now();
            setStatus("live");
            await ch.track(tracked.current);
            greet();
          } else {
            // CHANNEL_ERROR, TIMED_OUT or CLOSED. If the client hasn't got back in by itself when this
            // fires, start afresh with a fresh token.
            setStatus("failed");
            later();
          }
        });
      } catch {
        later();
      }
    };

    async function reopen() {
      if (busy || cancelled) return;
      busy = true;
      try {
        const old = current;
        current = null;
        channel.current = null;
        // Leaving closes the channel even when the server doesn't answer, so the topic is free again.
        if (old) await supabase.removeChannel(old);
        if (!cancelled) await open();
      } catch {
        later();
      } finally {
        busy = false;
      }
    }

    // Back online, or back to this tab: if the room isn't joined or joining, rejoin now.
    const check = () => {
      if (cancelled || busy || document.visibilityState !== "visible") return;
      if (current && current.state !== "closed" && current.state !== "errored") return;
      clearTimeout(retry);
      retry = undefined;
      attempt = 0;
      void reopen();
    };
    window.addEventListener("online", check);
    document.addEventListener("visibilitychange", check);
    void reopen();

    const pinger = setInterval(() => {
      if (pingsLeft > 0) {
        pingsLeft -= 1;
        ping();
      } else if (Date.now() - lastPing >= PING_MS) ping();
    }, PING_BURST_MS);
    const tick = setInterval(() => {
      // Paused too, so a pause that got lost on the way still reaches the other screen.
      if (leader.current === me.id) {
        const state = stateNow("tick");
        if (state) send("state", state);
      }
      // A wait, and being stuck, are repeated too: a lost message mustn't leave a screen waiting for good.
      const v = video.current;
      if (buffering.current) {
        if (v && v.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) {
          buffering.current = false;
          send("status", { by: me.id, buffering: false });
        } else send("status", { by: me.id, buffering: true });
      }
      evaluate();
      if (wait.current.holding && waitWhy.current) {
        const state = stateNow("pause");
        if (state && !state.playing) send("state", { ...state, auto: true, wait: waitWhy.current });
      }
    }, TICK_MS);

    return () => {
      cancelled = true;
      clearTimeout(retry);
      clearTimeout(leftTimer);
      clearInterval(pinger);
      clearInterval(tick);
      window.removeEventListener("online", check);
      document.removeEventListener("visibilitychange", check);
      channel.current = null;
      if (current) void supabase.removeChannel(current);
    };
  }, [nightId, me.id, partnerId, apply, send, stateNow, evaluate, toast, float]);

  // Share your file's length, name and size while you're in the room: when they change, and not more
  // than once a second (Realtime disconnects a client that updates its presence too often).
  const fileName = file?.name ?? null;
  const fileSize = file?.size ?? null;
  useEffect(() => {
    const info: FileInfo = { seconds, name: fileName, size: fileSize };
    if (status !== "live" || sameFileInfo(info, tracked.current)) return;
    const wait = Math.max(PRESENCE_DELAY_MS, trackedAt.current + PRESENCE_DELAY_MS - Date.now());
    const id = setTimeout(() => {
      tracked.current = info;
      trackedAt.current = Date.now();
      void channel.current?.track(info);
    }, wait);
    return () => clearTimeout(id);
  }, [seconds, fileName, fileSize, status]);

  // The partner's "waiting for you" stands while they keep repeating it.
  useEffect(() => {
    if (!heldBy) return;
    const id = setTimeout(() => setHeldBy(null), BUFFERING_TTL_MS);
    return () => clearTimeout(id);
  }, [heldBy]);

  // Unread messages count while the chat isn't on screen: collapsed, or full screen without it.
  const chatVisible = fullscreen ? screenChat : chatOpen;
  useEffect(() => {
    chatShown.current = chatVisible;
  }, [chatVisible]);
  useEffect(() => {
    const seen = () => {
      if (!document.fullscreenElement && chatShown.current) setUnread(0);
    };
    document.addEventListener("fullscreenchange", seen);
    return () => document.removeEventListener("fullscreenchange", seen);
  }, []);

  // Let go of the files when leaving.
  useEffect(() => {
    const held = urls.current;
    const timer = bufferTimer;
    return () => {
      held.forEach((url) => URL.revokeObjectURL(url));
      clearTimeout(timer.current);
    };
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
    clearTimeout(bufferTimer.current);
    bufferTimer.current = undefined;
    if (buffering.current) reportBuffering(false);
    setFile({ url: hold(f), name: f.name, size: f.size });
    setHash(null);
    void Promise.all([f.slice(0, HASH_CHUNK).arrayBuffer(), f.slice(Math.max(0, f.size - HASH_CHUNK)).arrayBuffer()]).then(
      ([head, tail]) => setHash(openSubtitlesHash(f.size, head, tail)),
      () => setHash(null),
    );
  }

  function showSubtitles(vtt: string, name: string) {
    release(subtitles?.url);
    setSubtitles({ url: hold(new Blob([vtt], { type: "text/vtt" })), name });
  }

  async function openSubtitles(f: File) {
    setSubtitleError(false);
    try {
      const vtt = toWebVtt(decodeSubtitles(await f.arrayBuffer()));
      if (!vtt.includes("-->")) throw new Error("No cues");
      showSubtitles(vtt, f.name);
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

  /**
   * On to `next` (null: that was the last episode), on this screen: each of you opens the next file, so the
   * old one and its subtitles go, and the room starts again from the beginning: nobody in charge, nothing
   * waited for. Presence follows by itself (no file yet).
   */
  function startEpisode(next: Progress | null) {
    setOffer(false);
    setMoving(false);
    setNextError(undefined);
    if (!next) {
      setAllDone(true);
      return;
    }
    episodeNow.current = next;
    setEpisode(next);
    setMovedOn(true);
    setFinding(false);
    release(file?.url);
    setFile(null);
    removeSubtitles();
    setSubtitleError(false);
    setProblem(null);
    setSeconds(null);
    setHash(null);
    setBlocked(false);
    audioChecked.current = false;
    leader.current = null;
    lastAction.current = 0;
    far.current = false;
    quiet.current = {};
    wait.current = NOT_WAITING;
    waitWhy.current = null;
    setWaitView({ reason: null, holding: false });
    setHeldBy(null);
    clearTimeout(bufferTimer.current);
    bufferTimer.current = undefined;
    if (buffering.current) reportBuffering(false);
  }

  /** "On to S2 E6": the list moves on (once for both of you), then both screens start the next episode. */
  async function moveOn() {
    const watched = episodeNow.current;
    if (!series || !watched || moving) return;
    const allowed = allowSend(sentMoves.current, Date.now(), EPISODE_LIMIT);
    sentMoves.current = allowed.sent;
    if (!allowed.ok) return;
    setMoving(true);
    setNextError(undefined);
    const result = await finishEpisode(nightId, watched);
    // The partner moved us on while we waited: we're there already.
    if (!sameEpisode(episodeNow.current, watched)) return;
    if ("error" in result) {
      setMoving(false);
      setNextError(result.error);
      return;
    }
    const move: EpisodeEvent = { by: me.id, watched: result.progress, next: episodeAfter(result.progress, series.seasonEpisodes) };
    lastMove.current = move;
    send("episode", move);
    startEpisode(move.next);
  }

  // The partner moved on: follow, if it's further on than where we are (an old or repeated message isn't).
  useEffect(() => {
    onEpisode.current = (payload) => {
      const move = readEpisodeEvent(payload, partnerId);
      if (!move || !series) return;
      const allowed = allowSend(gotMoves.current, Date.now(), EPISODE_LIMIT);
      gotMoves.current = allowed.sent;
      if (!allowed.ok) return;
      const now = episodeNow.current;
      if (move.next ? !isLaterEpisode(move.next, now) : allDone || (now !== null && isLaterEpisode(now, move.watched))) return;
      lastMove.current = move;
      toast({ kind: "movedOn", episode: move.next });
      startEpisode(move.next);
    };
  });

  /** Your own play, pause or seek: tell your partner, unless it was us following theirs. */
  function onLocal(type: "play" | "pause" | "seeked") {
    const until = quiet.current[type];
    if (until !== undefined) {
      delete quiet.current[type];
      if (Date.now() < until) return;
    }
    const state = stateNow(type === "seeked" ? "seek" : type);
    if (!state) return;
    const kind = type === "seeked" ? "seek" : type;
    leader.current = me.id;
    lastAction.current = Date.now();
    far.current = false;
    if (video.current) video.current.playbackRate = 1;
    if (type === "play") setBlocked(false);
    if (kind !== "seek") setHeldBy(null);
    wait.current = waitAfterAction(wait.current, kind);
    if (kind === "play") {
      // Pressed play while your partner isn't ready: wait for them instead (pressing again plays anyway).
      const reason = reasonNow();
      const step = waitStep(wait.current, reason, true);
      if (step.action === "hold" && reason) {
        wait.current = step.wait;
        waitWhy.current = reason;
        holdNow(reason);
        setWaitView({ reason, holding: true });
        return;
      }
    }
    send("state", state);
    evaluate();
  }

  function onLoaded() {
    const v = video.current;
    if (!v) return;
    if (Number.isFinite(v.duration)) setSeconds(Math.round(v.duration));
    // No picture (e.g. HEVC without hardware support), or Safari can play none of the sound tracks.
    const found = problemOnLoad(v);
    if (found) setProblem((p) => p ?? found);
    // Ask where your partner is, now that there's something to follow with.
    send("hello", {});
    evaluate();
  }

  function onTimeUpdate() {
    const v = video.current;
    if (!v || audioChecked.current || v.currentTime < SOUND_CHECK_AFTER_S) return;
    audioChecked.current = true;
    // Chrome and Edge play a file whose sound they can't decode (AC3, DTS) silently; say so.
    if (silentWhilePlaying(v)) setProblem((p) => p ?? "noSound");
  }

  /** The player ran out of data: if it stays stuck for a moment, the partner waits for us. */
  function onStuck() {
    if (bufferTimer.current !== undefined || buffering.current) return;
    bufferTimer.current = setTimeout(() => {
      bufferTimer.current = undefined;
      const v = video.current;
      if (v && v.readyState < HTMLMediaElement.HAVE_FUTURE_DATA) reportBuffering(true);
    }, BUFFERING_AFTER_MS);
  }

  function onUnstuck() {
    clearTimeout(bufferTimer.current);
    bufferTimer.current = undefined;
    if (buffering.current) reportBuffering(false);
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) openAny(f);
  }

  const sendReaction = useCallback(
    (kind: Reaction) => {
      const allowed = allowSend(sentReactions.current, Date.now(), REACTION_LIMIT);
      sentReactions.current = allowed.sent;
      if (!allowed.ok) return;
      float(kind, true);
      send("react", { by: me.id, kind });
    },
    [float, me.id, send],
  );

  function sendChat() {
    const message = cleanChat(draft);
    if (!message) return;
    const allowed = allowSend(sentChat.current, Date.now(), CHAT_LIMIT);
    sentChat.current = allowed.sent;
    if (!allowed.ok) return;
    const id = `${me.id.slice(0, 8)}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    send("chat", { by: me.id, id, text: message });
    setMessages((all) => [...all.slice(-(CHAT_KEPT - 1)), { id, by: me.id, text: message, at: Date.now() }]);
    setDraft("");
  }

  function toggleFullscreen() {
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => {});
      return;
    }
    const el = stage.current;
    if (!el) return;
    el.requestFullscreen().then(
      // Keep the player's own keyboard shortcuts (space, arrows) working in full screen.
      () => video.current?.focus(),
      () => {},
    );
  }

  const mine: FileInfo = { seconds, name: fileName, size: fileSize };
  const lengths = compareLengths(seconds, theirs?.seconds ?? null);
  const files = compareFiles(mine, theirs);
  const locale = dateLocale(language);
  const toastText = (item: Toast) => {
    switch (item.kind) {
      case "played":
        return text.played(partnerName);
      case "paused":
        return text.paused(partnerName);
      case "jumped":
        return text.jumped(partnerName, formatLength(Math.round(item.at)));
      case "joined":
        return text.joined(partnerName);
      case "left":
        return text.left(partnerName);
      case "said":
        return text.said(partnerName, item.message);
      case "movedOn":
        return item.episode ? text.next.movedOn(partnerName, episodeLabel(item.episode)) : text.next.allDone;
    }
  };
  const episodeLabel = (e: Progress) => getMessages(language).common.progress(e.season, e.episode);
  const upNext = series && episode ? episodeAfter(episode, series.seasonEpisodes) : null;
  const waiting =
    file && waitView.holding && waitView.reason
      ? {
          text: text.waiting[waitView.reason](partnerName),
          action: { label: text.playAnyway, onClick: () => void video.current?.play() },
        }
      : file && heldBy
        ? { text: text.waitingForYou[heldBy.reason](partnerName) }
        : null;
  const chat = (fill: boolean) => (
    <RoomChat
      language={language}
      meId={me.id}
      names={{ me: me.name, partner: partnerName }}
      messages={messages}
      draft={draft}
      onDraft={setDraft}
      onSend={sendChat}
      open={fill ? screenChat : chatOpen}
      onToggle={() => {
        if (fill) setScreenChat((v) => !v);
        else setChatOpen((v) => !v);
        setUnread(0);
      }}
      unread={chatVisible ? 0 : unread}
      live={status === "live"}
      fill={fill}
    />
  );

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
      <div
        className="grid min-w-0 gap-3"
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        {/* Full screen is this whole stage, not the <video>: the reactions, messages and chat stay on top. */}
        <div
          ref={stage}
          data-room-stage
          onKeyDown={(e) => {
            const typing = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
            if (!typing && canFullscreen && file && e.key.toLowerCase() === "f" && !e.ctrlKey && !e.metaKey && !e.altKey) {
              e.preventDefault();
              toggleFullscreen();
            }
          }}
          className={
            fullscreen
              ? `grid h-full gap-3 bg-black p-3 grid-rows-[minmax(0,1fr)_auto] ${screenChat ? "grid-cols-[minmax(0,1fr)_minmax(15rem,22rem)]" : "grid-cols-1"}`
              : "grid gap-3"
          }
        >
          <div data-room-screen className={`@container relative min-w-0 rounded-panel ${fullscreen ? "min-h-0" : ""}`}>
            {file ? (
              /* Native controls: they work with the keyboard and on phones. Their own full-screen button is
                 swapped for ours where the stage can go full screen. */
              <video
                ref={video}
                src={file.url}
                controls
                controlsList={canFullscreen ? "nofullscreen" : undefined}
                playsInline
                preload="auto"
                className={
                  fullscreen
                    ? "absolute inset-0 size-full bg-black object-contain focus-visible:-outline-offset-4"
                    : "aspect-video w-full rounded-panel border-[3px] border-outline bg-black"
                }
                onLoadedMetadata={onLoaded}
                onError={() => setProblem("unplayable")}
                onTimeUpdate={onTimeUpdate}
                onPlay={() => onLocal("play")}
                onPause={(e) => {
                  onLocal("pause");
                  // Stopped at the end (ours, or the partner's file ending first): offer the next episode.
                  if (series && episode && !allDone && atEnd(e.currentTarget.currentTime, e.currentTarget.duration)) setOffer(true);
                }}
                onSeeked={() => onLocal("seeked")}
                onWaiting={onStuck}
                onStalled={onStuck}
                onPlaying={onUnstuck}
                onCanPlay={onUnstuck}
                onEnded={() => {
                  if (series && episode && !allDone) setOffer(true);
                }}
                onDoubleClick={(e) => {
                  if (!canFullscreen) return;
                  e.preventDefault();
                  toggleFullscreen();
                }}
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
            ) : (
              <div
                className={`card grid min-h-72 content-center justify-items-center gap-3 p-6 text-center sm:aspect-video ${dragging ? "bg-accent-soft" : ""}`}
              >
                <Couches size={56} />
                {movedOn && episode && (
                  <div data-room-next-up className="grid max-w-[30rem] gap-1">
                    <p className="display-ink text-2xl">{text.next.heading(episodeLabel(episode))}</p>
                    <p className="font-bold">{text.next.dropIn}</p>
                  </div>
                )}
                {heldBy && <p className="max-w-[30rem] font-bold">{text.waitingForYou[heldBy.reason](partnerName)}</p>}
                <p className="max-w-[30rem] font-medium">{text.intro}</p>
                <FilePick accept={VIDEO_TYPES} onFile={openFile} className="btn">
                  {text.choose}
                </FilePick>
                <p className="text-sm text-muted max-sm:hidden">{text.drop}</p>
                <p className="max-w-[30rem] text-sm font-semibold">{text.stays}</p>
                <p className="max-w-[30rem] text-sm text-muted">{text.works}</p>
              </div>
            )}
            <RoomOverlay
              toasts={toasts.map((item) => ({ id: item.id, text: toastText(item) }))}
              bursts={bursts}
              onBurstDone={(id) => setBursts((all) => all.filter((b) => b.id !== id))}
              waiting={waiting}
            />
          </div>

          {file && offer && series && episode && (
            <RoomNext
              language={language}
              ended={episodeLabel(episode)}
              next={upNext && episodeLabel(upNext)}
              moving={moving}
              error={nextError}
              onMoveOn={() => void moveOn()}
              onClose={() => {
                setOffer(false);
                setNextError(undefined);
              }}
            />
          )}

          {file && (
            <div data-room-bar className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
              <div role="group" aria-label={text.reactions.label} className="flex flex-wrap gap-1.5">
                {REACTIONS.map((kind) => (
                  <button
                    key={kind}
                    type="button"
                    onClick={() => sendReaction(kind)}
                    aria-label={text.reactions.kinds[kind]}
                    title={text.reactions.kinds[kind]}
                    className="btn-quiet size-10 rounded-full p-0"
                  >
                    <ReactionSticker kind={kind} className="size-7" />
                  </button>
                ))}
              </div>
              <div className="flex gap-1.5">
                {fullscreen && (
                  <button
                    type="button"
                    onClick={() => {
                      setScreenChat((v) => !v);
                      setUnread(0);
                    }}
                    aria-pressed={screenChat}
                    aria-label={screenChat ? text.chat.hide : text.chat.show}
                    title={screenChat ? text.chat.hide : text.chat.show}
                    className="btn-quiet relative size-10 rounded-full p-0 aria-pressed:bg-accent aria-pressed:text-on-accent"
                  >
                    <ChatIcon className="size-5" />
                    {!screenChat && unread > 0 && (
                      <span className="absolute -right-2 -top-2 grid h-6 min-w-6 place-items-center rounded-full border-2 border-outline bg-accent px-1 text-xs font-bold text-on-accent">
                        <span aria-hidden>{unread}</span>
                        <span className="sr-only">{text.chat.unread(unread)}</span>
                      </span>
                    )}
                  </button>
                )}
                {canFullscreen && (
                  <button
                    type="button"
                    onClick={toggleFullscreen}
                    aria-label={fullscreen ? text.exitFullscreen : text.fullscreen}
                    title={fullscreen ? text.exitFullscreen : text.fullscreen}
                    className="btn-quiet size-10 rounded-full p-0"
                  >
                    <FullscreenIcon exit={fullscreen} className="size-5" />
                  </button>
                )}
              </div>
            </div>
          )}

          {fullscreen && screenChat && <div className="row-span-2 row-start-1 col-start-2 min-h-0">{chat(true)}</div>}
        </div>

        {file && (
          <>
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
              {series && episode && !allDone && !offer && (
                <button type="button" onClick={() => setOffer(true)} className="btn-quiet">
                  {text.next.open}
                </button>
              )}
              {finder.enabled && (
                <button type="button" onClick={() => setFinding((open) => !open)} aria-expanded={finding} className="btn-quiet">
                  {text.find.open}
                </button>
              )}
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
            {finder.enabled && finding && (
              <SubtitleFinder
                // A new episode searches afresh, for that episode.
                key={episode ? episodeLabel(episode) : "film"}
                nightId={nightId}
                language={language}
                hash={hash}
                query={file.name.replace(/\.[^.]+$/, "").replace(/[._]+/g, " ")}
                episode={episode ?? finder.episode}
                onLoad={(vtt, label) => {
                  showSubtitles(vtt, label);
                  setFinding(false);
                }}
                onClose={() => setFinding(false)}
              />
            )}
          </>
        )}
      </div>

      <div className="grid min-w-0 gap-5">
        <aside className="card grid gap-3 p-4 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-bold">{text.people}</h2>
            {status === "connecting" && <span className="font-semibold text-muted">{text.connecting}</span>}
          </div>
          {series && episode && (
            <p data-room-episode className="font-semibold">
              {allDone ? text.next.allDone : text.next.playing(episodeLabel(episode))}
            </p>
          )}
          <ul className="grid gap-2">
            <PersonRow person={me} fill="bg-me" here file={mine} language={language} />
            {partner && <PersonRow person={partner} fill="bg-partner" here={theirs !== null} file={theirs ?? NO_FILE} language={language} />}
          </ul>
          {files === "same" && <Verdict ok>{text.file.same}</Verdict>}
          {files === "differentName" && <Verdict>{text.file.differentName}</Verdict>}
          {files === "differentSize" && theirs?.size != null && fileSize !== null && (
            <Verdict danger>{text.file.differentSize(formatSize(fileSize, locale), formatSize(theirs.size, locale))}</Verdict>
          )}
          {lengths && (lengths.same ? <Verdict ok>{t.ready.sameLength(formatLength(seconds!))}</Verdict> : <Verdict danger>{t.ready.lengthsDiffer(formatLength(lengths.difference))}</Verdict>)}
          {partner && theirs && delay !== null && status === "live" && (
            <p className="text-muted tabular-nums">
              {text.delay(partner.name, new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(delay / 1000))}
            </p>
          )}
          {status === "failed" && (
            <p role="alert" className="font-semibold text-danger">
              {text.failed}
            </p>
          )}
        </aside>
        {!fullscreen && chat(false)}
      </div>
    </div>
  );
}

/** A line comparing your two files: a tick when they match, red when they don't, plain when unsure. */
function Verdict({ ok = false, danger = false, children }: { ok?: boolean; danger?: boolean; children: ReactNode }) {
  if (ok) {
    return (
      <p className="flex items-start gap-2 font-semibold">
        <span aria-hidden className="mt-px grid size-5 shrink-0 place-items-center rounded-full border-2 border-outline bg-accent text-on-accent">
          <CheckIcon className="size-3 [stroke-width:3.5]" />
        </span>
        {children}
      </p>
    );
  }
  return <p className={`font-semibold ${danger ? "text-danger" : ""}`}>{children}</p>;
}

/** One person in the room: their name tag, whether they're here, and their file's length, name and size. */
function PersonRow(props: { person: Person; fill: string; here: boolean; file: FileInfo; language: string }) {
  const text = getMessages(props.language).nights.room;
  const { seconds, name, size } = props.file;
  return (
    <li className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
      <span className={`max-w-full truncate rounded-full border-[2.5px] border-outline px-2.5 font-bold ${props.fill}`}>{props.person.name}</span>
      <span className={props.here ? "font-semibold" : "text-muted"}>{props.here ? text.here : text.away}</span>
      {props.here && <span className="text-muted tabular-nums">{seconds ? text.length(formatLength(seconds)) : text.noFile}</span>}
      {props.here && name && (
        <span className="w-full truncate text-muted" title={name}>
          {name}
          {size !== null && ` · ${formatSize(size, dateLocale(props.language))}`}
        </span>
      )}
    </li>
  );
}
