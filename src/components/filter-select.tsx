"use client";

import { useRouter } from "next/navigation";

/**
 * A labelled <select> that navigates as soon as it changes: `query` plus this select's value under `name`
 * (left out when empty). Lets server-rendered filter bars work without an Apply button.
 */
export function FilterSelect({
  path,
  query,
  name,
  label,
  value,
  options,
}: {
  path: string;
  /** The other filters to keep. */
  query: Record<string, string>;
  name: string;
  label: string;
  value: string;
  options: { value: string; label: string }[];
}) {
  const router = useRouter();
  return (
    <label className="grid gap-1 text-xs font-semibold text-muted">
      {label}
      {/* Uncontrolled so the choice shows straight away; remounts when the URL changes it. */}
      <select
        key={value}
        defaultValue={value}
        onChange={(e) => {
          const params = new URLSearchParams(query);
          if (e.target.value) params.set(name, e.target.value);
          else params.delete(name);
          const search = params.toString();
          router.push(search ? `${path}?${search}` : path);
        }}
        className="field py-1.5 text-sm font-normal"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
