import Link from "next/link";
import { Suspense } from "react";
import { Couch } from "@/components/couch";
import { BackIcon } from "@/components/icons";
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
    <div className="card grid justify-items-center gap-3 px-6 py-10 text-center">
      {/* One couch looking for the other, which has fallen over. */}
      <span aria-hidden className="mb-2 flex items-end gap-5">
        <Couch who="me" size={64} />
        <Couch who="partner" size={64} className="translate-x-1 translate-y-1 rotate-[-24deg]" />
      </span>
      <h1 className="display-ink text-[clamp(2rem,5vw,2.6rem)]">{t.common.notFound.heading}</h1>
      <p className="max-w-sm font-medium text-muted">{t.common.notFound.body}</p>
      <div className="mt-2 w-full max-w-md text-left">
        <SearchBox language={language} />
      </div>
      <Link href="/" className="btn-quiet mt-2">
        <BackIcon />
        {t.common.notFound.home}
      </Link>
    </div>
  );
}
