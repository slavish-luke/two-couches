"use client";

/* eslint-disable @next/next/no-img-element -- Private photos from signed Storage URLs: next/image would send them through the image loader, which is for TMDB's posters. */

import { useEffect, useRef, useState, useTransition } from "react";
import { ArrowIcon, BackIcon, CloseIcon, PlusIcon } from "@/components/icons";
import { getMessages } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/client";
import type { NightPhoto } from "@/lib/together";
import {
  fitWithin,
  formatBytes,
  MAX_PHOTO_FILE_BYTES,
  MAX_PHOTO_INPUT_BYTES,
  MAX_PHOTOS_PER_NIGHT,
  PHOTO_BUCKET,
  PHOTO_LONG_SIDE,
  photoPaths,
  THUMB_LONG_SIDE,
  timeAgo,
} from "@/lib/together-rules";
import { addNightPhoto, removeNightPhoto } from "./actions";

/** Signed links last an hour; the page refreshes long before most visits end. */
const SIGNED_FOR_S = 60 * 60;

type Person = { id: string; name: string };
type Encoded = { full: Blob; thumb: Blob; extension: "webp" | "jpg"; width: number; height: number };

/** Draws a picture at a size and encodes it: WebP where the browser can, else JPEG. Canvas drops all metadata. */
async function encode(bitmap: ImageBitmap, size: { width: number; height: number }, type: string, quality: number) {
  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("No 2D canvas");
  context.imageSmoothingQuality = "high";
  context.drawImage(bitmap, 0, 0, size.width, size.height);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
  canvas.width = canvas.height = 0;
  if (!blob) throw new Error("Encoding failed");
  return blob;
}

/** A photo, resized (longest side 1600 px, and a 480 px thumbnail) and stripped of its camera details. */
async function prepare(file: File): Promise<Encoded> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  try {
    const full = fitWithin(bitmap.width, bitmap.height, PHOTO_LONG_SIDE);
    let type = "image/webp";
    let fullBlob = await encode(bitmap, full, type, 0.82);
    // Safari can't write WebP and quietly hands back a PNG.
    if (fullBlob.type !== "image/webp") {
      type = "image/jpeg";
      fullBlob = await encode(bitmap, full, type, 0.85);
    }
    if (fullBlob.size > MAX_PHOTO_FILE_BYTES) fullBlob = await encode(bitmap, full, type, 0.6);
    const thumb = await encode(bitmap, fitWithin(bitmap.width, bitmap.height, THUMB_LONG_SIDE), type, 0.75);
    return { full: fullBlob, thumb, extension: type === "image/webp" ? "webp" : "jpg", ...full };
  } finally {
    bitmap.close();
  }
}

/**
 * A night's photo album: a small grid of both of your photos with a lightbox, "Add photos" (resized and
 * compressed on this device, then uploaded straight to the couple's private folder in Storage), and delete
 * for your own. Pictures are shown through signed links that expire, never public ones.
 */
export function NightAlbum(props: {
  nightId: string;
  coupleId: string;
  photos: NightPhoto[];
  me: Person;
  partner: Person | null;
  language: string;
  serverNow: number;
  /** Whether photos can be added yet (the night has started). */
  canAdd: boolean;
}) {
  const { photos, me, language } = props;
  const t = getMessages(language);
  const text = t.together.album;
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string>();
  const [open, setOpen] = useState<number | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [removing, startRemoving] = useTransition();
  const dialog = useRef<HTMLDialogElement>(null);


  // Signs links for the thumbnails (and the open photo) not signed yet. RLS decides: only your couple's folder.
  const openPhoto = open === null ? null : photos[open];
  const wanted = [...photos.map((p) => p.thumb_path), ...(openPhoto ? [openPhoto.path] : [])].filter((path) => !urls[path]);
  const wantedKey = wanted.join("|");
  useEffect(() => {
    if (!wantedKey) return;
    let cancelled = false;
    createClient()
      .storage.from(PHOTO_BUCKET)
      .createSignedUrls(wantedKey.split("|"), SIGNED_FOR_S)
      .then(({ data, error: signError }) => {
        if (cancelled) return;
        if (signError || !data) {
          setError(text.errors.loadFailed);
          return;
        }
        setUrls((known) => ({ ...known, ...Object.fromEntries(data.flatMap((d) => (d.signedUrl && d.path ? [[d.path, d.signedUrl]] : []))) }));
      });
    return () => {
      cancelled = true;
    };
  }, [wantedKey, text.errors.loadFailed]);

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (open !== null && !d.open) d.showModal();
    if (open === null && d.open) d.close();
  }, [open]);

  // A photo deleted on the other screen while it's open here.
  const shownIndex = open !== null && open >= photos.length ? null : open;

  async function add(files: File[]) {
    setError(undefined);
    const room = MAX_PHOTOS_PER_NIGHT - photos.length;
    if (files.length > room) setError(text.errors.full(MAX_PHOTOS_PER_NIGHT));
    const chosen = files.slice(0, Math.max(0, room));
    if (chosen.length === 0) return;
    const supabase = createClient();
    setBusy({ done: 0, total: chosen.length });
    for (const [i, file] of chosen.entries()) {
      setBusy({ done: i + 1, total: chosen.length });
      if (!file.type.startsWith("image/")) {
        setError(text.errors.notImage(file.name));
        continue;
      }
      if (file.size > MAX_PHOTO_INPUT_BYTES) {
        setError(text.errors.tooBig(file.name));
        continue;
      }
      let photo: Encoded;
      try {
        photo = await prepare(file);
      } catch {
        setError(text.errors.notImage(file.name));
        continue;
      }
      const id = crypto.randomUUID();
      const paths = photoPaths(props.coupleId, props.nightId, id, photo.extension);
      const contentType = photo.extension === "webp" ? "image/webp" : "image/jpeg";
      const options = { contentType, upsert: false, cacheControl: "31536000" };
      const [full, thumb] = await Promise.all([
        supabase.storage.from(PHOTO_BUCKET).upload(paths.path, photo.full, options),
        supabase.storage.from(PHOTO_BUCKET).upload(paths.thumb_path, photo.thumb, options),
      ]);
      if (full.error || thumb.error) {
        console.error("Uploading a photo failed", full.error ?? thumb.error);
        await supabase.storage.from(PHOTO_BUCKET).remove([paths.path, paths.thumb_path]);
        setError(text.errors.uploadFailed);
        continue;
      }
      const result = await addNightPhoto({
        id,
        nightId: props.nightId,
        extension: photo.extension,
        bytes: photo.full.size + photo.thumb.size,
        width: photo.width,
        height: photo.height,
      });
      if (result.error) {
        setError(result.error);
        break;
      }
    }
    setBusy(null);
  }

  if (!props.canAdd && photos.length === 0) return null;
  const bytes = photos.reduce((sum, p) => sum + p.bytes, 0);
  const full = photos.length >= MAX_PHOTOS_PER_NIGHT;
  const byLine = (photo: NightPhoto) =>
    photo.uploaded_by === me.id ? text.byYou : text.by(props.partner && photo.uploaded_by === props.partner.id ? props.partner.name : t.common.yourPartner);

  const addButton = props.canAdd && !full && (
    <label
      className={`chip cursor-pointer gap-1 px-2.5 py-0.5 text-[13px] has-focus-visible:outline-[3px] has-focus-visible:outline-offset-2 has-focus-visible:outline-(--focus) ${busy ? "pointer-events-none opacity-60" : ""}`}
    >
      <PlusIcon className="size-3.5 [stroke-width:3]" />
      {busy ? text.adding(busy.done, busy.total) : text.add}
      <input
        type="file"
        accept="image/*"
        multiple
        disabled={Boolean(busy)}
        className="sr-only"
        onChange={(e) => {
          const files = [...(e.target.files ?? [])];
          e.target.value = "";
          void add(files);
        }}
      />
    </label>
  );
  const errorLine = error && (
    <p role="alert" className="font-semibold text-danger">
      {error}
    </p>
  );

  // No photos yet: one quiet row, so every past night doesn't carry an empty box.
  if (photos.length === 0) {
    return (
      <div data-album className="grid gap-1 text-sm">
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
          {addButton}
          <span className="text-xs text-muted">{text.empty}</span>
        </div>
        {errorLine}
      </div>
    );
  }

  return (
    <div data-album className="paper grid gap-2.5 rounded-control border-[3px] border-outline p-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
        <span className="flex flex-wrap items-baseline gap-x-2">
          <span className="text-base font-bold">{text.heading}</span>
          <span className="font-semibold text-muted">{text.usage(photos.length, formatBytes(bytes, language))}</span>
        </span>
        {addButton}
      </div>

        <ul className="grid grid-cols-4 gap-1.5 sm:grid-cols-6">
          {photos.map((photo, i) => (
            <li key={photo.id}>
              <button
                type="button"
                aria-label={`${text.open(i + 1, photos.length)} · ${byLine(photo)}`}
                onClick={() => {
                  setConfirming(false);
                  setOpen(i);
                }}
                className="relative block aspect-square w-full overflow-hidden rounded-[10px] border-2 border-outline bg-current/10 transition-transform duration-150 ease-(--ease-spring) hover:-rotate-2"
              >
                {urls[photo.thumb_path] && (
                  <img src={urls[photo.thumb_path]} alt="" loading="lazy" decoding="async" className="size-full object-cover" />
                )}
                <span
                  aria-hidden
                  className={`absolute bottom-1 right-1 size-2.5 rounded-full border-[1.5px] border-outline ${photo.uploaded_by === me.id ? "bg-me" : "bg-partner"}`}
                />
              </button>
            </li>
          ))}
        </ul>

      <p className="text-xs text-muted">{text.privacy}</p>
      {errorLine}

      <dialog
        ref={dialog}
        aria-label={shownIndex !== null ? text.open(shownIndex + 1, photos.length) : text.heading}
        onClose={() => setOpen(null)}
        onKeyDown={(e) => {
          if (shownIndex === null) return;
          if (e.key === "ArrowRight" && shownIndex < photos.length - 1) setOpen(shownIndex + 1);
          if (e.key === "ArrowLeft" && shownIndex > 0) setOpen(shownIndex - 1);
        }}
        onClick={(e) => {
          // A tap on the backdrop closes it.
          if (e.target === e.currentTarget) setOpen(null);
        }}
        data-album-lightbox
        className="m-auto max-h-[calc(100dvh-2rem)] w-[min(56rem,calc(100vw-2rem))] overflow-visible bg-transparent p-0 text-ink backdrop:bg-[color-mix(in_srgb,var(--p-ink)_72%,transparent)]"
      >
        {shownIndex !== null && photos[shownIndex] && (
          <figure className="card grid gap-2 p-2.5 sm:p-3">
            <div className="relative grid place-items-center overflow-hidden rounded-[10px] border-2 border-outline bg-[color-mix(in_srgb,var(--p-ink)_88%,transparent)]">
              {urls[photos[shownIndex].path] || urls[photos[shownIndex].thumb_path] ? (
                <img
                  src={urls[photos[shownIndex].path] ?? urls[photos[shownIndex].thumb_path]}
                  alt=""
                  width={photos[shownIndex].width}
                  height={photos[shownIndex].height}
                  className="max-h-[calc(100dvh-10rem)] w-auto max-w-full object-contain"
                />
              ) : (
                <span className="block aspect-[4/3] w-full" />
              )}
            </div>
            <figcaption className="flex flex-wrap items-center gap-2">
              <span className="min-w-0 flex-1 font-semibold">
                {text.open(shownIndex + 1, photos.length)} · {byLine(photos[shownIndex])}
                <span className="text-muted"> · {timeAgo(photos[shownIndex].created_at, props.serverNow, language)}</span>
              </span>
              <span className="flex flex-wrap items-center gap-1.5">
                {photos[shownIndex].uploaded_by === me.id &&
                  (confirming ? (
                    <>
                      <span className="text-sm font-semibold">{text.confirmRemove}</span>
                      <button
                        type="button"
                        disabled={removing}
                        onClick={() => {
                          const photo = photos[shownIndex];
                          startRemoving(async () => {
                            const result = await removeNightPhoto(photo.id);
                            if (result.error) setError(result.error);
                            setConfirming(false);
                            setOpen(null);
                          });
                        }}
                        className="btn-quiet px-3 py-1 text-sm text-danger"
                      >
                        {text.yesRemove}
                      </button>
                      <button type="button" onClick={() => setConfirming(false)} className="btn-quiet px-3 py-1 text-sm">
                        {text.keep}
                      </button>
                    </>
                  ) : (
                    <button type="button" onClick={() => setConfirming(true)} className="btn-quiet px-3 py-1 text-sm">
                      {text.remove}
                    </button>
                  ))}
                <button
                  type="button"
                  aria-label={text.previous}
                  disabled={shownIndex === 0}
                  onClick={() => setOpen(shownIndex - 1)}
                  className="btn-quiet grid size-9 place-items-center p-0 disabled:opacity-40"
                >
                  <BackIcon className="size-4" />
                </button>
                <button
                  type="button"
                  aria-label={text.next}
                  disabled={shownIndex === photos.length - 1}
                  onClick={() => setOpen(shownIndex + 1)}
                  className="btn-quiet grid size-9 place-items-center p-0 disabled:opacity-40"
                >
                  <ArrowIcon className="size-4" />
                </button>
                <button
                  type="button"
                  aria-label={text.close}
                  autoFocus
                  onClick={() => setOpen(null)}
                  className="btn-quiet grid size-9 place-items-center p-0"
                >
                  <CloseIcon className="size-4 [stroke-width:2.75]" />
                </button>
              </span>
            </figcaption>
          </figure>
        )}
      </dialog>
    </div>
  );
}
