import { Couches } from "@/components/couch";
import { SkelButton, SkelField, Skeleton, SkelPageTitle, SkelParagraph, SkelText } from "@/components/skeleton";

/** Pairing up while it loads: the heading and intro, then the spotlight with "start" beside "have a code". */
export function CoupleSkeleton() {
  return (
    <Skeleton className="grid gap-7">
      <div className="grid gap-3">
        <SkelPageTitle width="10rem" />
        <SkelParagraph className="font-medium" lines={2} />
      </div>
      <div className="spotlight grid gap-6 p-6 sm:p-8">
        <Couches size={72} className="justify-self-center" />
        <div className="grid gap-8 sm:grid-cols-2 sm:gap-0">
          <div className="grid content-start gap-3 sm:pr-8">
            <SkelText bar="pop" className="display-pop text-[2rem]" width="70%" />
            <SkelParagraph lines={2} />
            <SkelButton width="8rem" className="justify-self-start" />
          </div>
          <div className="grid content-start gap-3 border-t-[3px] border-dashed border-line pt-8 sm:border-t-0 sm:border-l-[3px] sm:pl-8 sm:pt-0">
            <SkelText bar="pop" className="display-pop text-[2rem]" width="70%" />
            <div className="grid gap-3">
              <div className="grid gap-1.5">
                <SkelText className="font-semibold" width="7rem" />
                <SkelField className="text-lg font-bold" />
              </div>
              <SkelButton width="6rem" className="justify-self-start" />
            </div>
          </div>
        </div>
      </div>
    </Skeleton>
  );
}
