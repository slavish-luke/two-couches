import { Suspense } from "react";
import { getI18n } from "@/lib/i18n/server";
import { getPartner, requireProfile } from "@/lib/session";
import { getWaitingSends } from "@/lib/shelf";
import { tmdbLocale } from "@/lib/tmdb";
import { SentCard } from "./sent-card";

/**
 * Home's "Sent to you" cards (Sprint 21): titles your partner sent you that you haven't answered.
 * Self-contained with its own boundary; nothing shows while there's nothing waiting.
 */
export function SentToYou() {
  return (
    <Suspense>
      <SentCards />
    </Suspense>
  );
}

async function SentCards() {
  const [profile, partner, { t }] = await Promise.all([requireProfile(), getPartner(), getI18n()]);
  if (!profile.couple_id || !profile.country || !partner) return null;
  const locales = [tmdbLocale(profile.language, profile.home_country)];
  if (partner.country) locales.push(tmdbLocale(partner.language, partner.home_country));
  const sends = await getWaitingSends(profile.couple_id, profile.id, locales);
  if (sends.length === 0) return null;
  const name = partner.display_name || t.common.yourPartner;

  return (
    <section data-sent-to-you aria-label={t.shelf.send.label} className="grid gap-3">
      {sends.map((send) => (
        <SentCard key={send.id} send={send} partnerName={name} language={profile.language} />
      ))}
    </section>
  );
}
