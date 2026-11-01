import { Suspense } from "react";
import { SearchBox } from "@/components/search-box";
import { getI18n } from "@/lib/i18n/server";

export default function NotFound() {
  return (
    <Suspense>
      <NothingHere />
    </Suspense>
  );
}

async function NothingHere() {
  const { language, t } = await getI18n();
  return (
    <div className="grid gap-4">
      <h1 className="font-display text-3xl font-bold tracking-tight">{t.common.notFound.heading}</h1>
      <p className="text-muted">{t.common.notFound.body}</p>
      <SearchBox language={language} />
    </div>
  );
}
