import type { ReactNode } from "react";

/**
 * A button-styled label around a hidden file input (the watch room, a night's ready check). Picking a file
 * never uploads it: `onFile` gets the File to read on this device.
 */
export function FilePick(props: {
  accept: string;
  onFile: (file: File) => void;
  className: string;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <label
      aria-disabled={props.disabled || undefined}
      className={`${props.className} cursor-pointer has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-outline aria-disabled:pointer-events-none aria-disabled:opacity-50`}
    >
      <input
        type="file"
        accept={props.accept}
        disabled={props.disabled}
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

/** The video files the watch room and the ready check offer to open. */
export const VIDEO_TYPES = "video/*,.mkv,.mp4,.m4v,.webm,.mov";
