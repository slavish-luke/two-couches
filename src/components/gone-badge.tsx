import { stillGone, type AlertDetails } from "@/lib/alert-rules";
import { getMessages } from "@/lib/i18n";
import type { Availability, Watcher } from "@/lib/watch";

type Person = Watcher & { id: string };
type Label = ReturnType<typeof getMessages>["discovery"]["gone"];

/**
 * "Left Netflix" tags for a list title that left a service one of you pays for and is still gone (see
 * stillGone()), with a dot in that person's colour (one tag with both dots when you both lost the same
 * services). Takes the pending lookups, so the list renders first; wrap it in <Suspense>. Renders nothing
 * while nothing is gone. For Home's list cards (Sprint 19).
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
  // One tag per set of lost services, with the dots of everyone who lost them.
  const tags = new Map<string, { services: string[]; people: { who: string; isMe: boolean }[] }>();
  for (const p of people) {
    const services = stillGone(details[p.person.id], p.person, now).map((s) => s.name);
    if (services.length === 0) continue;
    const key = services.join("\n");
    const tag = tags.get(key) ?? { services, people: [] };
    tag.people.push({ who: p.who, isMe: p.isMe });
    tags.set(key, tag);
  }
  return [...tags].map(([key, tag]) => <GoneTag key={key} services={tag.services} people={tag.people} label={t} language={props.language} />);
}

/** A "Left Netflix" tag with a dot for each person who lost it. */
export function GoneTag(props: {
  services: string[];
  people: { who: string; isMe: boolean }[];
  label: Label;
  language: string;
}) {
  const names = props.services.join(", ");
  const who = new Intl.ListFormat(props.language, { type: "conjunction" }).format(props.people.map((p) => p.who));
  return (
    <span
      data-gone-tag
      className="relative inline-flex max-w-full items-center gap-1.5 rounded-full border-2 border-outline bg-danger-soft px-2 text-sm font-bold leading-snug"
    >
      <span aria-hidden className="flex shrink-0 -space-x-1">
        {props.people.map((p) => (
          <span key={p.who} className={`size-2.5 rounded-full border-2 border-outline ${p.isMe ? "bg-me" : "bg-partner"}`} />
        ))}
      </span>
      <span aria-hidden className="truncate">
        {props.label.tag(names)}
      </span>
      <span className="sr-only">{props.label.label(names, who)}</span>
    </span>
  );
}
