import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Couches } from "@/components/couch";
import { PageLoading } from "@/components/page-loading";
import { getI18n, localisedTitle } from "@/lib/i18n/server";
import { requireProfile } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { startCouple } from "./actions";
import { CopyCode, JoinForm } from "./join-form";

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
  const text = t.account.couple;

  if (!profile.couple_id) {
    return (
      <div className="grid gap-7">
        <div className="grid gap-3">
          <h1 className="display -rotate-1 text-[clamp(2.4rem,5vw,3.6rem)]">{text.pairUp}</h1>
          <p className="max-w-[65ch] font-medium text-muted">{text.pairUpIntro}</p>
        </div>
        {/* The moment two people join: the screen's one spotlight. */}
        <section className="spotlight grid gap-6 p-6 sm:p-8">
          <Couches size={72} className="justify-self-center" />
          <div className="grid gap-8 sm:grid-cols-2 sm:gap-0">
            <div className="grid content-start gap-3 sm:pr-8">
              <h2 className="display text-[2rem] [color:var(--pop)]">{text.start}</h2>
              <p className="text-muted">{text.startIntro}</p>
              <form action={startCouple}>
                <button className="btn">{text.getCode}</button>
              </form>
            </div>
            <div className="grid content-start gap-3 border-t-[3px] border-dashed border-line pt-8 sm:border-t-0 sm:border-l-[3px] sm:pt-0 sm:pl-8">
              <h2 className="display text-[2rem] [color:var(--pop)]">{text.haveCode}</h2>
              <JoinForm language={language} />
            </div>
          </div>
        </section>
      </div>
    );
  }

  const supabase = await createClient();
  const [{ data: couple }, { count }] = await Promise.all([
    supabase.from("couples").select("invite_code").eq("id", profile.couple_id).single(),
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("couple_id", profile.couple_id),
  ]);
  if ((count ?? 0) >= 2 || !couple) redirect("/");

  const code = `${couple.invite_code.slice(0, 4)}-${couple.invite_code.slice(4)}`;
  return (
    <div className="grid gap-7">
      <div className="grid gap-3">
        <h1 className="display -rotate-1 text-[clamp(2.4rem,5vw,3.6rem)]">{text.invite}</h1>
        <p className="max-w-[65ch] font-medium text-muted">
          {text.inviteIntro.before}
          <strong className="font-bold text-ink">{text.pairUp}</strong>
          {text.inviteIntro.after}
        </p>
      </div>
      {/* The moment two people join: the screen's one spotlight. */}
      <section className="spotlight grid justify-items-center gap-5 px-5 py-8 text-center sm:py-10">
        <Couches size={72} />
        <h2 className="text-lg font-bold">{text.inviteCode}</h2>
        <p className="display -rotate-2 select-all whitespace-nowrap text-[clamp(2.6rem,11vw,5rem)] tracking-[0.08em]">
          {code}
        </p>
        <CopyCode code={code} language={language} />
      </section>
    </div>
  );
}
