/**
 * Whether this browser can play a video file the way you'd watch it: at all, with a picture, and with
 * sound. Browser code only (it reads a <video> element). Used by the watch room as you play, and by a
 * night's ready check, which reads your file before the night (probeFile()). Nothing is uploaded: the
 * file is read from this device through an object URL.
 */

/** What can be wrong with a file in this browser. */
export type MediaProblem = "unplayable" | "noPicture" | "noSound";

type Video = HTMLVideoElement & {
  /** Safari: the audio tracks it can play. */
  audioTracks?: { length: number };
  /** Chrome and Edge: how much sound has been decoded so far. */
  webkitAudioDecodedByteCount?: number;
  /** Firefox. */
  mozHasAudio?: boolean;
};

/**
 * What's wrong once the file's details have loaded (`loadedmetadata`), or null. Sound with no picture is a
 * video the browser can't decode (e.g. HEVC without hardware support); Safari says when it can play none of
 * the sound tracks.
 */
export function problemOnLoad(video: HTMLVideoElement): MediaProblem | null {
  if (video.videoWidth === 0) return "noPicture";
  const audio = (video as Video).audioTracks;
  if (audio && audio.length === 0) return "noSound";
  return null;
}

/** The longest a file is read before saying it's silent: Chrome and Edge decode sound as they play. */
export const SOUND_CHECK_AFTER_S = 2;

/**
 * Whether a video that has played for SOUND_CHECK_AFTER_S seconds has no sound this browser can play.
 * Chrome and Edge play a file whose sound they can't decode (AC3, DTS) silently, and say so only here.
 */
export function silentWhilePlaying(video: HTMLVideoElement): boolean {
  const v = video as Video;
  return v.webkitAudioDecodedByteCount === 0 || v.mozHasAudio === false;
}

/** Whether this browser can tell a silent file at all (Chrome, Edge and Firefox can; Safari says on load). */
function canHearSilence(video: HTMLVideoElement) {
  const v = video as Video;
  return typeof v.webkitAudioDecodedByteCount === "number" || typeof v.mozHasAudio === "boolean";
}

/** How long probeFile() waits for the browser before giving up on a file. */
const PROBE_TIMEOUT_MS = 15_000;

/**
 * Reads a video file in a hidden, muted player: its length in whole seconds (null if the browser can't
 * tell) and anything that would stop you watching it here. It plays a couple of seconds, muted, to hear
 * whether the sound decodes. The player and its object URL are let go afterwards.
 */
export function probeFile(file: File): Promise<{ seconds: number | null; problem: MediaProblem | null }> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    let seconds: number | null = null;
    let settled = false;

    const done = (problem: MediaProblem | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      video.pause();
      video.removeAttribute("src");
      video.load();
      URL.revokeObjectURL(url);
      resolve({ seconds, problem });
    };
    const timer = setTimeout(() => done(seconds === null ? "unplayable" : null), PROBE_TIMEOUT_MS);

    video.addEventListener("error", () => done("unplayable"), { once: true });
    video.addEventListener(
      "loadedmetadata",
      () => {
        if (Number.isFinite(video.duration) && video.duration > 0) seconds = Math.round(video.duration);
        const problem = problemOnLoad(video);
        if (problem || !canHearSilence(video)) return done(problem);
        const listen = () => {
          if (video.currentTime < SOUND_CHECK_AFTER_S && !video.ended) return;
          video.removeEventListener("timeupdate", listen);
          done(silentWhilePlaying(video) ? "noSound" : null);
        };
        video.addEventListener("timeupdate", listen);
        // A browser that won't play even muted: the length is still worth having.
        video.play().catch(() => done(null));
      },
      { once: true },
    );
    video.src = url;
  });
}
