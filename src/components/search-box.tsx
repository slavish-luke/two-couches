import Form from "next/form";
import { getMessages } from "@/lib/i18n";

/** Search form that navigates to /search?q=… without a full page load. */
export function SearchBox({
  language,
  query = "",
  autoFocus = false,
}: {
  language: string;
  query?: string;
  autoFocus?: boolean;
}) {
  const t = getMessages(language).common.searchBox;
  return (
    <Form action="/search" role="search" className="flex gap-2">
      <div className="relative min-w-0 flex-1">
        {/* A magnifying glass, drawn like the icons in icons.tsx. */}
        <svg
          aria-hidden
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.5}
          strokeLinecap="round"
          className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-ink"
        >
          <circle cx="10.5" cy="10.5" r="6" />
          <path d="m15 15 5 5" />
        </svg>
        <input
          name="q"
          type="search"
          required
          maxLength={100}
          defaultValue={query}
          autoFocus={autoFocus}
          placeholder={t.placeholder}
          aria-label={t.placeholder}
          className="field h-full pl-10"
        />
      </div>
      <button className="btn shrink-0 px-3 sm:px-4">{t.button}</button>
    </Form>
  );
}
