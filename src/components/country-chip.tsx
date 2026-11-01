/** Two-letter country code in the person's colour: ochre for you, teal for your partner. */
export function CountryChip({ code, name, isMe }: { code: string; name: string; isMe: boolean }) {
  const style = isMe ? "bg-me-soft text-me" : "bg-partner-soft text-partner";
  return (
    <span className={`rounded-full px-2 py-0.5 font-mono text-xs font-medium ${style}`} title={name}>
      {code}
    </span>
  );
}
