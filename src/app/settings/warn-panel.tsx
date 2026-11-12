import { SkelField, SkelParagraph, SkelText } from "@/components/skeleton";
import { getWarnKeywords } from "@/lib/guidance";
import { getI18n } from "@/lib/i18n/server";
import { getPartner, requireProfile } from "@/lib/session";
import { WarnSettings } from "./warn-settings";

/** Settings → "Warn me about" (Sprint 19), for paired people. The title page links here (#warn). */
export async function WarnPanel() {
  const [profile, partner, { language, t }] = await Promise.all([requireProfile(), getPartner(), getI18n()]);
  if (!profile.couple_id) return null;
  const lists = await getWarnKeywords(profile.couple_id);
  return (
    <section id="warn" className="card grid scroll-mt-24 content-start gap-4">
      <div className="grid gap-1.5">
        <h2 className="display-ink text-2xl">{t.discovery.warn.heading}</h2>
        <p className="max-w-[65ch] text-muted">{t.discovery.warn.intro}</p>
      </div>
      <WarnSettings
        mine={lists[profile.id] ?? []}
        partner={
          partner ? { name: partner.display_name || t.common.yourPartner, keywords: lists[partner.id] ?? [] } : null
        }
        language={language}
      />
    </section>
  );
}

/** The panel while it loads: heading, intro, your topics and the search field. */
export function WarnSkeleton() {
  return (
    <div aria-busy className="card grid content-start gap-4">
      <div className="grid gap-1.5">
        <SkelText bar="ink" className="display-ink text-2xl" width="11rem" />
        <SkelParagraph lines={3} smLines={2} />
      </div>
      <div className="grid gap-5">
        <div className="grid gap-2">
          <SkelText className="font-bold" width="7rem" />
          <SkelText width="5rem" />
        </div>
        <div className="grid gap-1.5">
          <SkelText className="font-semibold" width="6rem" />
          <SkelField />
        </div>
      </div>
    </div>
  );
}
