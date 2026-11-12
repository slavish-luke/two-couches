"use server";

import { refresh } from "next/cache";
import { headers } from "next/headers";
import { after } from "next/server";
import { localDate } from "@/lib/list-rules";
import { requireCoupleProfile } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { isFirstTap, isFreeOn } from "@/lib/time-rules";
import { pushToPartner } from "@/lib/together";

// Runs as the signed-in user, so RLS keeps it to your own evenings.

/**
 * Says you're free tonight (your own local date), or takes it back. The first "free" of an evening also
 * pushes your partner ("{name} is free tonight", or "You're both free tonight" when they are too); taking
 * it back and saying it again doesn't push again, since the row stays (only `free` changes).
 */
export async function setFreeTonight(free: boolean): Promise<{ ok: boolean }> {
  const profile = await requireCoupleProfile();
  if (typeof free !== "boolean") return { ok: false };
  const day = localDate(profile.time_zone);
  const supabase = await createClient();

  const [{ data: rows, error: readError }, { data: partner }] = await Promise.all([
    supabase.from("free_evenings").select("profile_id, on_day, free").eq("couple_id", profile.couple_id),
    supabase.from("profiles").select("id, time_zone").eq("couple_id", profile.couple_id).neq("id", profile.id).maybeSingle(),
  ]);
  if (readError) {
    console.error("Reading free evenings failed", readError);
    return { ok: false };
  }

  const first = isFirstTap(rows, profile.id, day);
  const { error } = first
    ? free
      ? await supabase.from("free_evenings").insert({ profile_id: profile.id, couple_id: profile.couple_id, on_day: day })
      : { error: null }
    : await supabase.from("free_evenings").update({ free }).eq("profile_id", profile.id).eq("on_day", day);
  if (error) {
    console.error("Saving a free evening failed", error);
    return { ok: false };
  }

  if (first && free && partner) {
    const both = isFreeOn(rows, partner.id, localDate(partner.time_zone));
    const contact = (await headers()).get("origin");
    if (contact) {
      after(() =>
        pushToPartner(
          profile,
          (t, name) =>
            both
              ? { title: t.time.free.push.both.title, body: t.time.free.push.both.body, url: "/", tag: `free-${day}` }
              : { title: t.time.free.push.one.title(name), body: t.time.free.push.one.body, url: "/", tag: `free-${day}` },
          contact,
        ),
      );
    }
  }
  refresh();
  return { ok: true };
}
