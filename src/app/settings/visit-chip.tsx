import { getMessages } from "@/lib/i18n";
import { activeVisit, countryName, formatVisitDate, type PlaceFields } from "@/lib/places";

/** "In GB until 20 Dec" on a person card while that person is visiting somewhere (same couch mode). */
export function VisitChip({ person, language, now }: { person: PlaceFields; language: string; now: Date }) {
  const visit = activeVisit(person, now);
  if (!visit) return null;
  return (
    <span
      className="inline-block max-w-full -rotate-2 rounded-[12px] border-2 border-outline bg-surface px-2 py-px text-center text-xs font-bold leading-snug text-ink shadow-[2px_2px_0_var(--outline)]"
      title={countryName(visit.country, language)}
    >
      {/* The date wraps as one piece ("20 Dec", never "20" on its own line). */}
      {getMessages(language).places.chip(visit.country, formatVisitDate(visit.until, language, now).replace(/ /g, " "))}
    </span>
  );
}
