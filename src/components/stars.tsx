import { getMessages } from "@/lib/i18n";
import { StarIcon } from "./icons";

/** A 1-5 rating as stars, read-only. */
export function Stars({ rating, who, language }: { rating: number; who: string; language: string }) {
  return (
    <span
      role="img"
      aria-label={getMessages(language).common.stars(who, rating)}
      title={`${who}: ${rating}/5`}
      className="inline-flex gap-px align-[-0.1em]"
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <StarIcon key={n} filled={n <= rating} className="size-[1.05em]" />
      ))}
    </span>
  );
}
