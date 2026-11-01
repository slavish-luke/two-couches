/** A 1-5 rating as stars, read-only. */
export function Stars({ rating, who }: { rating: number; who: string }) {
  return (
    <span role="img" aria-label={`${who}: ${rating} out of 5 stars`} title={`${who}: ${rating}/5`}>
      <span aria-hidden className="text-ink">
        {"★".repeat(rating)}
      </span>
      <span aria-hidden className="text-line">
        {"★".repeat(5 - rating)}
      </span>
    </span>
  );
}
