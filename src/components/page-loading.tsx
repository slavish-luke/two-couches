/** Placeholder while a page's data loads. Wordless, so it suits every UI language. */
export function PageLoading() {
  return (
    <div aria-busy className="grid animate-pulse gap-4">
      <div className="h-9 w-48 rounded-lg bg-line" />
      <div className="h-24 rounded-xl bg-line/60" />
      <div className="h-24 rounded-xl bg-line/60" />
    </div>
  );
}
