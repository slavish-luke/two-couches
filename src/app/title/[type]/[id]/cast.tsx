import Link from "next/link";
import { PersonPhoto } from "@/components/person-photo";
import { getI18n } from "@/lib/i18n/server";
import { getCredits } from "@/lib/people";
import type { CreditPerson } from "@/lib/people-rules";
import type { TitleRef } from "@/lib/watch";

/** The scroller: room below for the cards' shadows and hover lift, which it would otherwise clip. */
export const CAST_ROW = "-mx-4 flex snap-x scroll-px-4 gap-4 overflow-x-auto px-4 pb-4 pt-2";
/** One card's width in the row (the photo fills it). */
export const CAST_CARD = "w-28 shrink-0 snap-start sm:w-32";

/**
 * Cast and crew (Sprint 23): a film's directors or a series' creators, then the top-billed cast in a row,
 * each opening their own page. From TMDB in the viewer's language (24 h fetch cache). Wrap it in
 * <Suspense> with CastSkeleton; it says so rather than failing the page when TMDB can't be asked.
 */
export async function Cast({ titleRef, locale }: { titleRef: TitleRef; locale: string }) {
  const { t } = await getI18n();
  const text = t.people.cast;
  const credits = await getCredits(titleRef, locale).catch((error) => {
    console.error("Loading the cast failed", error);
    return null;
  });
  if (credits && credits.cast.length === 0 && credits.leads.length === 0) return null;
  const leadLabel = titleRef.media_type === "movie" ? text.directedBy : text.createdBy;

  return (
    <section data-cast aria-labelledby="cast" className="grid gap-3">
      <h2 id="cast" className="display text-[2rem]">
        {text.heading}
      </h2>
      {!credits ? (
        <p className="font-medium text-muted">{text.failed}</p>
      ) : (
        <>
          {credits.leads.length > 0 && (
            <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-lg">
              <span className="font-bold">{leadLabel(credits.leads.length)}</span>
              {credits.leads.map((person) => (
                <Link key={person.id} href={`/person/${person.id}`} className="tap-area font-semibold underline underline-offset-4 hover:decoration-[3px]">
                  {person.name}
                </Link>
              ))}
            </p>
          )}
          {credits.cast.length > 0 ? (
            <ul className={CAST_ROW}>
              {credits.cast.map((person) => (
                <CastCard key={person.id} person={person} as={text.as} />
              ))}
            </ul>
          ) : (
            <p className="font-medium text-muted">{text.none}</p>
          )}
        </>
      )}
    </section>
  );
}

/** One of the cast: their photo, name and part, as a link to their page. Dressed like a title card in each skin. */
function CastCard({ person, as }: { person: CreditPerson; as: (character: string) => string }) {
  return (
    <li data-title-card data-cast-card className={CAST_CARD}>
      <Link href={`/person/${person.id}`} className="group/card grid content-start justify-items-start gap-1">
        <span className="poster-frame mb-1.5 block w-full transition duration-200 ease-(--ease-spring) group-hover/card:-translate-y-1.5 group-hover/card:-rotate-2">
          <PersonPhoto path={person.profile_path} name={person.name} size="card" alt="" className="shadow-[4px_4px_0_var(--outline)]" />
        </span>
        <span data-item-title className="line-clamp-2 font-bold leading-snug group-hover/card:underline">
          {person.name}
        </span>
        {person.character && <span className="line-clamp-2 text-sm text-muted">{as(person.character)}</span>}
      </Link>
    </li>
  );
}
