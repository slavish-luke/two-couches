import type { ReactNode } from "react";

/**
 * A paper tile that is the whole control for a hidden checkbox or radio: it lifts when pointed at and turns
 * grape when chosen. `className` gives its shape (layout, corners, outline width, shadow when chosen).
 */
export function ChoiceTile({
  type,
  name,
  value,
  checked,
  onChange,
  className = "",
  children,
}: {
  type: "checkbox" | "radio";
  name: string;
  value: string | number;
  checked: boolean;
  onChange: () => void;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label
      className={`cursor-pointer border-outline bg-surface transition duration-150 ease-(--ease-spring) hover:-translate-y-0.5 has-checked:bg-accent has-checked:text-on-accent has-focus-visible:outline-3 has-focus-visible:outline-offset-3 has-focus-visible:outline-accent ${className}`}
    >
      <input type={type} name={name} value={value} checked={checked} onChange={onChange} className="sr-only" />
      {children}
    </label>
  );
}
