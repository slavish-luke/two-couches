/**
 * Placeholder while a page's data loads, shaped like the page: "cards" for lists of cards, "posters" for
 * poster grids (Browse, Coming soon). Wordless, so it suits every UI language.
 */
export function PageLoading({ variant = "cards" }: { variant?: "cards" | "posters" }) {
  return (
    <div aria-busy className="grid gap-4 motion-safe:animate-pulse">
      <div className="h-9 w-48 rounded-lg bg-line" />
      {variant === "cards" ? (
        <>
          <div className="h-24 rounded-xl bg-line/60" />
          <div className="h-24 rounded-xl bg-line/60" />
          <div className="h-24 rounded-xl bg-line/60" />
        </>
      ) : (
        <>
          <div className="flex gap-2">
            <div className="h-8 w-24 rounded-full bg-line/60" />
            <div className="h-8 w-20 rounded-full bg-line/60" />
            <div className="h-8 w-28 rounded-full bg-line/60" />
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-4">
            {Array.from({ length: 8 }, (_, i) => (
              <div key={i} className="grid gap-2">
                <div className="aspect-[2/3] rounded-lg bg-line/60" />
                <div className="h-4 w-3/4 rounded bg-line/60" />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
