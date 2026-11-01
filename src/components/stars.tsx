import { getMessages } from "@/lib/i18n";

/** A 1-5 rating as stars, read-only. */
export function Stars({ rating, who, language }: { rating: number; who: string; language: string }) {
  return (
    <span role="img" aria-label={getMessages(language).common.stars(who, rating)} title={`${who}: ${rating}/5`}>
      <span aria-hidden className="text-ink">
        {"★".repeat(rating)}
      </span>
      <span aria-hidden className="text-line">
        {"★".repeat(5 - rating)}
      </span>
    </span>
  );
}
