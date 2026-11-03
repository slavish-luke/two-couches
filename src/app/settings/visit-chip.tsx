import { getMessages } from "@/lib/i18n";
import { activeVisit, countryName, formatVisitDate, type PlaceFields } from "@/lib/places";

/** "In GB until 20 Dec" on a person card while that person is visiting somewhere (same couch mode). */
export function VisitChip({ person, language, now }: { person: PlaceFields; language: string; now: Date }) {
  const visit = activeVisit(person, now);
  if (!visit) return null;
  return (
    <span
      className="rounded-full border border-line px-2 py-0.5 text-xs font-medium text-muted"
      title={countryName(visit.country, language)}
    >
      {getMessages(language).places.chip(visit.country, formatVisitDate(visit.until, language, now))}
    </span>
  );
}
