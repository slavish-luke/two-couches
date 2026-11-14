import { Suspense } from "react";
import { getI18n } from "@/lib/i18n/server";
import { getWrapups } from "@/lib/reviews";
import { getPartner, requireProfile } from "@/lib/session";
import { tmdbLocale } from "@/lib/tmdb";
import { TrayItem } from "@/components/tray-item";
import { WrapupCard } from "./wrapup-card";

/**
 * "How was it?" cards for the watch nights that ended in the last week and that you haven't wrapped up.
 * Self-contained for the home page: renders nothing until there's one.
 */
export function AfterNight() {
  return (
    <Suspense>
      <Wrapups />
    </Suspense>
  );
}

async function Wrapups() {
  const [profile, partner, { language, t }] = await Promise.all([requireProfile(), getPartner(), getI18n()]);
  if (!profile.couple_id || !profile.country) return null;
  const locales = [tmdbLocale(profile.language, profile.home_country)];
  if (partner?.country) locales.push(tmdbLocale(partner.language, partner.home_country));

  const wrapups = await getWrapups(profile.couple_id, profile.id, locales);
  if (wrapups.length === 0) return null;

  const summary =
    wrapups.length === 1 ? t.reviews.wrapup.heading(wrapups[0].title.title) : t.list.tray.wrapups(wrapups.length);

  // Folded into Home's "Waiting for you" tray on phones (TrayItem); as it was from lg up.
  return (
    <TrayItem summary={summary} attention>
      <section aria-label={t.reviews.wrapup.label}>
        <ul className="grid gap-6">
          {wrapups.map((wrapup) => (
            <WrapupCard
              // Keyed by the night only, so your draft survives your partner saving theirs meanwhile.
              key={wrapup.night.id}
              wrapup={wrapup}
              me={{ id: profile.id, name: t.common.you }}
              partner={partner && { id: partner.id, name: partner.display_name || t.common.yourPartner }}
              language={language}
              timeZone={profile.time_zone}
            />
          ))}
        </ul>
      </section>
    </TrayItem>
  );
}
