import Form from "next/form";

/** Search form that navigates to /search?q=… without a full page load. */
export function SearchBox({ query = "", autoFocus = false }: { query?: string; autoFocus?: boolean }) {
  return (
    <Form action="/search" role="search" className="flex gap-2">
      <input
        name="q"
        type="search"
        required
        maxLength={100}
        defaultValue={query}
        autoFocus={autoFocus}
        placeholder="Search films and series"
        aria-label="Search films and series"
        className="field"
      />
      <button className="btn">Search</button>
    </Form>
  );
}
