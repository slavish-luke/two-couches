import { redirect } from "next/navigation";
import { Suspense } from "react";
import { PageLoading } from "@/components/page-loading";
import { getI18n, localisedTitle } from "@/lib/i18n/server";
import { requireProfile } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { startCouple } from "./actions";
import { JoinForm } from "./join-form";

export const generateMetadata = localisedTitle("couple");

export default function CouplePage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <Couple />
    </Suspense>
  );
}

async function Couple() {
  const [profile, { language, t }] = await Promise.all([requireProfile(), getI18n()]);

  if (!profile.couple_id) {
    return (
      <div className="grid gap-6">
        <div className="grid gap-2">
          <h1 className="font-display text-3xl font-bold tracking-tight">{t.account.couple.pairUp}</h1>
          <p className="text-muted">{t.account.couple.pairUpIntro}</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <section className="card grid content-start gap-3">
            <h2 className="font-display text-lg font-semibold">{t.account.couple.start}</h2>
            <p className="text-sm text-muted">{t.account.couple.startIntro}</p>
            <form action={startCouple}>
              <button className="btn w-full">{t.account.couple.getCode}</button>
            </form>
          </section>
          <section className="card grid content-start gap-3">
            <h2 className="font-display text-lg font-semibold">{t.account.couple.haveCode}</h2>
            <JoinForm language={language} />
          </section>
        </div>
      </div>
    );
  }

  const supabase = await createClient();
  const [{ data: couple }, { count }] = await Promise.all([
    supabase.from("couples").select("invite_code").eq("id", profile.couple_id).single(),
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("couple_id", profile.couple_id),
  ]);
  if ((count ?? 0) >= 2 || !couple) redirect("/");

  const code = couple.invite_code;
  return (
    <div className="grid gap-6">
      <div className="grid gap-2">
        <h1 className="font-display text-3xl font-bold tracking-tight">{t.account.couple.invite}</h1>
        <p className="text-muted">
          {t.account.couple.inviteIntro.before}
          <strong className="text-ink">{t.account.couple.pairUp}</strong>
          {t.account.couple.inviteIntro.after}
        </p>
      </div>
      <p className="card select-all text-center font-mono text-4xl font-semibold tracking-[0.25em]">
        {code.slice(0, 4)}-{code.slice(4)}
      </p>
    </div>
  );
}
