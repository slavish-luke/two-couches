import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { countryName, formatLocalTime } from "@/lib/places";
import { requireProfile } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

export default function HomePage() {
  return (
    <Suspense fallback={<p className="text-muted">Loading…</p>}>
      <OurList />
    </Suspense>
  );
}

async function OurList() {
  const profile = await requireProfile();
  if (!profile.country) redirect("/settings?welcome=1");
  if (!profile.couple_id) redirect("/couple");

  const supabase = await createClient();
  const { data: members } = await supabase
    .from("profiles")
    .select("id, display_name, country, time_zone")
    .eq("couple_id", profile.couple_id)
    .order("created_at");
  const partner = members?.find((m) => m.id !== profile.id);
  const now = new Date();

  return (
    <div className="grid gap-8">
      <div className="grid gap-3 sm:grid-cols-2">
        {[members?.find((m) => m.id === profile.id), partner].map((person, i) =>
          person ? (
            <div key={person.id} className="card grid gap-1">
              <div className="flex items-center gap-2">
                <span className="font-display text-lg font-semibold">{person.display_name || "No name yet"}</span>
                {person.country && (
                  <CountryChip
                    code={person.country}
                    name={countryName(person.country, profile.language)}
                    isMe={person.id === profile.id}
                  />
                )}
              </div>
              <span className="text-sm text-muted">
                {person.country
                  ? `${formatLocalTime(now, person.time_zone, profile.language)} local time`
                  : "Still setting up"}
              </span>
            </div>
          ) : (
            <Link key={i} href="/couple" className="card grid gap-1 border-dashed hover:border-partner">
              <span className="font-display text-lg font-semibold">Waiting for your partner</span>
              <span className="text-sm text-muted">Share your invite code →</span>
            </Link>
          ),
        )}
      </div>

      <section className="grid gap-3">
        <h1 className="font-display text-3xl font-bold tracking-tight">Our list</h1>
        <div className="card grid justify-items-center gap-1 py-12 text-center">
          <p className="font-semibold">Nothing here yet</p>
          <p className="text-sm text-muted">Searching for films and shows to add is coming next.</p>
        </div>
      </section>
    </div>
  );
}

function CountryChip({ code, name, isMe }: { code: string; name: string; isMe: boolean }) {
  const style = isMe ? "bg-me-soft text-me" : "bg-partner-soft text-partner";
  return (
    <span className={`rounded-full px-2 py-0.5 font-mono text-xs font-medium ${style}`} title={name}>
      {code}
    </span>
  );
}
