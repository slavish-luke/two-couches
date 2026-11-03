import Image from "next/image";
import Link from "next/link";
import { Poster } from "@/components/poster";
import { adviseServices, showcase, type AdvisorTitle } from "@/lib/advisor-rules";
import { getI18n } from "@/lib/i18n/server";
import { getList } from "@/lib/list";
import { countryName, isCountry } from "@/lib/places";
import { getServices } from "@/lib/services";
import { getPartner, requireProfile } from "@/lib/session";
import { getAvailability } from "@/lib/titles";
import { tmdbLocale } from "@/lib/tmdb";
import { titleHref, titleKey, tmdbImage, type Watcher } from "@/lib/watch";

const POSTERS = 4;

/**
 * "What would another service get you?": for the services in your home country you don't pay for, how
 * many Up next titles each would make watchable for both of you and for you. Uses home countries (this is
 * about what you subscribe to at home, so a visit doesn't change it) and the saved services.
 */
export async function Advisor() {
  const [profile, partner, { language, t }] = await Promise.all([requireProfile(), getPartner(), getI18n()]);
  if (!profile.couple_id || !isCountry(profile.home_country)) return null;
  const home = profile.home_country;
  const text = t.places.advisor;

  const locale = tmdbLocale(profile.language, home);
  const locales = partner?.home_country ? [locale, tmdbLocale(partner.language, partner.home_country)] : [locale];
  const me: Watcher = { country: home, services: profile.services };
  const them: Watcher | null = partner?.home_country
    ? { country: partner.home_country, services: partner.services }
    : null;

  const [entries, services] = await Promise.all([getList(profile.couple_id, locales), getServices(home)]);
  const upNext: AdvisorTitle[] = entries
    .filter((e) => e.status === "want" || e.status === "watching")
    .map((e) => ({ media_type: e.media_type, tmdb_id: e.tmdb_id, title: e.title, poster_path: e.poster_path }));
  const availability = await getAvailability(upNext, them && them.country !== home ? [home, them.country] : [home]);
  const { suggestions, idle } = adviseServices(upNext, me, them, availability);
  const serviceName = (id: number) => services.find((s) => s.provider_id === id)?.name;
  const idleNames = idle.map(serviceName).filter((name): name is string => Boolean(name));

  return (
    <section className="grid gap-3 border-t border-line pt-6">
      <div className="grid gap-1">
        <h2 className="font-display text-2xl font-bold tracking-tight">{text.heading}</h2>
        <p className="text-muted">{text.intro(countryName(home, language))}</p>
      </div>

      {upNext.length === 0 ? (
        <p className="card py-3 text-sm text-muted">{text.emptyList}</p>
      ) : suggestions.length === 0 ? (
        <p className="card py-3 text-sm text-muted">{text.nothing}</p>
      ) : (
        <ol className="grid gap-3">
          {suggestions.map((advice) => {
            const shown = showcase(advice, POSTERS);
            const more = advice.forYou.length - shown.length;
            return (
              <li key={advice.provider_id} className="card grid gap-3 p-4 sm:grid-cols-[1fr_auto] sm:items-center">
                <div className="flex items-center gap-3">
                  {advice.logo_path ? (
                    <Image
                      src={tmdbImage(advice.logo_path, "w92")}
                      alt=""
                      width={40}
                      height={40}
                      unoptimized
                      className="shrink-0 rounded-lg"
                    />
                  ) : (
                    <span aria-hidden className="size-10 shrink-0 rounded-lg border border-line bg-bg" />
                  )}
                  <div className="grid gap-0.5">
                    <span className="font-display text-lg font-semibold leading-snug">{advice.name}</span>
                    <span className="flex flex-wrap gap-x-3 text-sm">
                      {them && (
                        <span className={advice.forBoth.length > 0 ? "font-semibold text-both" : "text-muted"}>
                          {text.forBoth(advice.forBoth.length)}
                        </span>
                      )}
                      <span className="text-me">{text.forYou(advice.forYou.length)}</span>
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {shown.map((title) => (
                    <Link key={titleKey(title)} href={titleHref(title)} title={title.title} className="hover:opacity-80">
                      <Poster path={title.poster_path} title={title.title} size="xs" language={language} />
                    </Link>
                  ))}
                  {more > 0 && <span className="text-sm text-muted">{text.more(more)}</span>}
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {idleNames.length > 0 && (
        <ul className="grid gap-1 text-sm text-muted">
          {idleNames.map((name) => (
            <li key={name}>{text.idle(name)}</li>
          ))}
        </ul>
      )}
      <p className="text-xs text-muted">{text.saveFirst}</p>
    </section>
  );
}
