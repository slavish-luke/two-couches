import { stillGone, type AlertDetails } from "@/lib/alert-rules";
import { getMessages } from "@/lib/i18n";
import type { Availability, Watcher } from "@/lib/watch";

type Person = Watcher & { id: string };

/**
 * "Left Netflix" tags for a list title that left a service one of you pays for and is still gone (see
 * stillGone()), with a dot in that person's colour. Takes the pending lookups, so the list renders first;
 * wrap it in <Suspense>. Renders nothing while nothing is gone. For Home's list cards (Sprint 19).
 */
export async function GoneBadge(props: {
  gone: Promise<Record<string, AlertDetails>>;
  availability: Promise<Record<string, Availability>>;
  titleKey: string;
  me: Person;
  partner: (Person & { name: string }) | null;
  language: string;
}) {
  const [gone, availability] = await Promise.all([props.gone, props.availability]);
  const details = gone[props.titleKey];
  if (!details) return null;
  const now = availability[props.titleKey] ?? {};
  const t = getMessages(props.language).discovery.gone;
  const people = [
    { person: props.me as Person, who: t.you, isMe: true },
    ...(props.partner ? [{ person: props.partner as Person, who: props.partner.name, isMe: false }] : []),
  ];
  const tags = people
    .map((p) => ({ ...p, services: stillGone(details[p.person.id], p.person, now).map((s) => s.name) }))
    .filter((p) => p.services.length > 0);
  if (tags.length === 0) return null;

  return tags.map(({ person, who, isMe, services }) => <GoneTag key={person.id} services={services} who={who} isMe={isMe} label={t} />);
}

/** One person's "Left Netflix" tag. */
export function GoneTag(props: {
  services: string[];
  who: string;
  isMe: boolean;
  label: ReturnType<typeof getMessages>["discovery"]["gone"];
}) {
  const names = props.services.join(", ");
  return (
    <span
      data-gone-tag
      className="inline-flex max-w-full items-center gap-1.5 rounded-full border-2 border-outline bg-danger-soft px-2 text-sm font-bold leading-snug"
    >
      <span aria-hidden className={`size-2.5 shrink-0 rounded-full border-2 border-outline ${props.isMe ? "bg-me" : "bg-partner"}`} />
      <span aria-hidden className="truncate">
        {props.label.tag(names)}
      </span>
      <span className="sr-only">{props.label.label(names, props.who)}</span>
    </span>
  );
}
