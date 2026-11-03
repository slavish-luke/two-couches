import Link from "next/link";
import { getI18n } from "@/lib/i18n/server";

/** The home page's way into /pick. Reads the viewer's language, so render it inside <Suspense>. */
export async function PickLink() {
  const { t } = await getI18n();
  return (
    <Link href="/pick" className="card flex items-center justify-between gap-4 py-3 transition hover:border-muted">
      <span className="grid gap-0.5">
        <span className="font-semibold">{t.pick.homeLink.heading}</span>
        <span className="text-sm text-muted">{t.pick.homeLink.body}</span>
      </span>
      <span aria-hidden className="text-lg font-semibold text-partner">
        →
      </span>
    </Link>
  );
}
