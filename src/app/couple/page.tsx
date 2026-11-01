import { redirect } from "next/navigation";
import { Suspense } from "react";
import { requireProfile } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { startCouple } from "./actions";
import { JoinForm } from "./join-form";

export const metadata = { title: "Your couple · Two Couches" };

export default function CouplePage() {
  return (
    <Suspense fallback={<p className="text-muted">Loading…</p>}>
      <Couple />
    </Suspense>
  );
}

async function Couple() {
  const profile = await requireProfile();

  if (!profile.couple_id) {
    return (
      <div className="grid gap-6">
        <div className="grid gap-2">
          <h1 className="font-display text-3xl font-bold tracking-tight">Pair up</h1>
          <p className="text-muted">One of you starts a couple and shares the code. The other joins with it.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <section className="card grid content-start gap-3">
            <h2 className="font-display text-lg font-semibold">Start our couple</h2>
            <p className="text-sm text-muted">You’ll get a code to send to your partner.</p>
            <form action={startCouple}>
              <button className="btn w-full">Get an invite code</button>
            </form>
          </section>
          <section className="card grid content-start gap-3">
            <h2 className="font-display text-lg font-semibold">I have a code</h2>
            <JoinForm />
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
        <h1 className="font-display text-3xl font-bold tracking-tight">Invite your partner</h1>
        <p className="text-muted">
          Send them this code. They sign in, open <strong className="text-ink">Pair up</strong>, and enter it.
          Once they’ve joined, you’ll both see the same list.
        </p>
      </div>
      <p className="card select-all text-center font-mono text-4xl font-semibold tracking-[0.25em]">
        {code.slice(0, 4)}-{code.slice(4)}
      </p>
    </div>
  );
}
