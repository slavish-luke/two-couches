import { Couches } from "./couch";
import { SkelText } from "./skeleton";

/**
 * The generic loading state, for pages that don't have one shaped like themselves yet (the title page and
 * Pick): the couches over a few blank paper cards. Every other page draws its own from the pieces in
 * `skeleton.tsx`, next to the page (e.g. `src/app/stats/skeleton.tsx`). Wordless.
 */
export function PageLoading() {
  return (
    <div aria-busy className="grid gap-6">
      <Couches size={56} className="justify-self-start" />
      <div className="h-12 w-56 rounded-full border-[3px] border-outline bg-surface/80" />
      {Array.from({ length: 3 }, (_, i) => (
        <div key={i} className="card grid h-28 content-center gap-2">
          <SkelText className="text-xl" width="50%" />
          <SkelText width="33%" />
        </div>
      ))}
    </div>
  );
}
