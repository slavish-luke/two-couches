"use client";

import { useId, useState } from "react";
import { getMessages } from "@/lib/i18n";

/** Longer than this (characters), the biography starts folded to a few lines with "Read more". */
const FOLD_AFTER = 600;

/** A person's biography from TMDB, folded when it's long so their films and series stay in reach. */
export function Biography({ paragraphs, language }: { paragraphs: string[]; language: string }) {
  const text = getMessages(language).people.person;
  const id = useId();
  const long = paragraphs.join(" ").length > FOLD_AFTER;
  const [open, setOpen] = useState(false);
  const folded = long && !open;
  return (
    <div className="grid justify-items-start gap-2">
      <div id={id} className="grid max-w-[62ch] gap-3 text-[1.05rem] font-medium leading-relaxed">
        {folded ? (
          // Folded, it's one clamped block (line-clamp counts the lines of a single box).
          <p className="line-clamp-6">{paragraphs.join(" ")}</p>
        ) : (
          paragraphs.map((p, i) => <p key={i}>{p}</p>)
        )}
      </div>
      {long && (
        <button
          type="button"
          aria-expanded={open}
          aria-controls={id}
          onClick={() => setOpen((v) => !v)}
          className="tap-area text-sm font-bold underline underline-offset-4"
        >
          {open ? text.readLess : text.readMore}
        </button>
      )}
    </div>
  );
}
