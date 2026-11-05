import { Couch } from "@/components/couch";
import { SkelButton, Skeleton, SkelParagraph, SkelText } from "@/components/skeleton";

/** The offline card while its words load: the two couches drifting apart, a heading, a line and the button. */
export function OfflineSkeleton() {
  return (
    <Skeleton className="card grid justify-items-center gap-3 px-6 py-10">
      <span className="mb-2 flex items-end gap-6">
        <Couch who="me" size={64} className="-rotate-6" />
        <Couch who="partner" size={64} className="translate-y-1 rotate-[22deg]" />
      </span>
      <SkelText bar="ink" className="display-ink text-[clamp(2rem,5vw,2.6rem)]" width="14rem" />
      <SkelParagraph className="w-full max-w-sm justify-items-center font-medium" lines={2} />
      <SkelButton width="8rem" className="mt-3" />
    </Skeleton>
  );
}
