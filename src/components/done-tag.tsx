import { CheckIcon } from "./icons";

/** A tick and a few words on the soft accent, for something that just worked ("Saved", "Installed"). */
export function DoneTag({ children, status = false }: { children: string; status?: boolean }) {
  return (
    <p
      role={status ? "status" : undefined}
      className="inline-flex items-center gap-1.5 justify-self-start rounded-control border-2 border-outline bg-accent-soft px-2.5 py-0.5 text-sm font-bold"
    >
      <CheckIcon />
      {children}
    </p>
  );
}
