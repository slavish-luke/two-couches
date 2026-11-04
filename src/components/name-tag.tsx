/** A person's name on a little tag in their colour, with ink text (the person colours fail contrast as text). */
export function NameTag({ name, who, className = "" }: { name: string; who: "me" | "partner"; className?: string }) {
  return (
    <span
      className={`paper inline-flex max-w-full items-center rounded-full border-[2.5px] border-outline px-2.5 text-sm font-bold ${who === "me" ? "bg-me" : "bg-partner"} ${className}`}
    >
      <span className="truncate">{name}</span>
    </span>
  );
}
