import { SearchBox } from "@/components/search-box";

export default function NotFound() {
  return (
    <div className="grid gap-4">
      <h1 className="font-display text-3xl font-bold tracking-tight">Nothing here</h1>
      <p className="text-muted">That page or title doesn&apos;t exist. Try searching for it instead.</p>
      <SearchBox />
    </div>
  );
}
