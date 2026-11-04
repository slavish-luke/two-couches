import { Couches } from "./couch";

/**
 * Placeholder while a page's data loads, shaped like the page: "cards" for lists of cards, "posters" for
 * poster grids (Browse, Coming soon), "home" for the home page (clocks and the next night beside the list).
 * Blank paper cut-outs in the skin's outlines with the couches bobbing on top, so a page transition that
 * lands before the data still lands in the cartoon. Wordless, so it suits every UI language. `wide` fills
 * the layout like the pages that set data-wide.
 */
export function PageLoading({
  variant = "cards",
  wide = false,
}: {
  variant?: "cards" | "posters" | "home";
  wide?: boolean;
}) {
  const panel = "rounded-panel border-[3px] border-outline bg-surface shadow-[6px_6px_0_var(--outline)]";
  const pill = "rounded-full border-[3px] border-outline bg-surface/80";
  const bar = "rounded-full bg-outline/10 motion-safe:animate-pulse";
  const poster = "aspect-[2/3] rounded-poster border-[3px] border-outline bg-accent-soft";
  return (
    <div aria-busy data-wide={wide || undefined} className="grid gap-6">
      {variant === "home" ? (
        <div className="grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-12">
          <div className="grid content-start gap-7 lg:col-span-5 xl:col-span-4">
            <div className={`grid h-44 place-items-center ${panel}`}>
              <Couches size={56} />
            </div>
            <div className={`h-60 -rotate-1 ${panel} bg-accent`} />
          </div>
          <div className="grid content-start gap-4 lg:col-span-7 xl:col-span-8">
            <div className="flex gap-3">
              <div className={`h-12 w-36 ${pill}`} />
              <div className={`h-12 w-32 ${pill}`} />
            </div>
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className={`tilt-row flex gap-4 p-3 ${panel}`}>
                <div className={`w-16 shrink-0 ${poster}`} />
                <div className="grid flex-1 content-start gap-2 pt-1">
                  <div className={`h-6 w-1/2 ${bar}`} />
                  <div className={`h-4 w-1/3 ${bar}`} />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : variant === "cards" ? (
        <>
          <Couches size={56} className="justify-self-start" />
          <div className={`h-12 w-56 ${pill}`} />
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className={`grid h-28 content-center gap-2 px-5 ${panel}`}>
              <div className={`h-6 w-1/2 ${bar}`} />
              <div className={`h-4 w-1/3 ${bar}`} />
            </div>
          ))}
        </>
      ) : (
        <>
          <Couches size={56} className="justify-self-start" />
          <div className="flex gap-2">
            <div className={`h-9 w-24 ${pill}`} />
            <div className={`h-9 w-20 ${pill}`} />
            <div className={`h-9 w-28 ${pill}`} />
          </div>
          <div
            className={`grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-4 ${wide ? "md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5" : ""}`}
          >
            {Array.from({ length: wide ? 12 : 8 }, (_, i) => (
              <div key={i} className="grid gap-2">
                <div className={`${poster} shadow-[4px_4px_0_var(--outline)]`} />
                <div className={`h-4 w-3/4 ${bar}`} />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
