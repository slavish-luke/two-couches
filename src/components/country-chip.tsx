/** Two-letter country code on a tag in the person's colour. */
export function CountryChip({ code, name, isMe }: { code: string; name: string; isMe: boolean }) {
  return (
    <span
      className={`rounded-full border-2 border-outline px-1.5 text-xs font-bold leading-snug text-ink ${isMe ? "bg-me" : "bg-partner"}`}
      title={name}
    >
      {code}
    </span>
  );
}
