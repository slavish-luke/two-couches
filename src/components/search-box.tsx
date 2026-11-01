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
      <input
        name="q"
        type="search"
        required
        maxLength={100}
        defaultValue={query}
        autoFocus={autoFocus}
        placeholder={t.placeholder}
        aria-label={t.placeholder}
        className="field"
      />
      <button className="btn">{t.button}</button>
    </Form>
  );
}
