import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { CountryChip } from "@/components/country-chip";
import { DismissButton } from "@/components/dismiss-button";
import { ListSync } from "@/components/list-sync";
import { PageLoading } from "@/components/page-loading";
import { Poster } from "@/components/poster";
import { RemindButton } from "@/components/remind-button";
import { getReminderKeys } from "@/lib/alerts";
import { type Messages } from "@/lib/i18n";
import { getI18n } from "@/lib/i18n/server";
import { getCategories, getListItem } from "@/lib/list";
import { countryName } from "@/lib/places";
import { getDismissedKeys } from "@/lib/recommend";
import { getPartner, requireProfile } from "@/lib/session";
import { getAvailability, getTitle } from "@/lib/titles";
import { tmdbLocale } from "@/lib/tmdb";
import {
  isMediaType,
  tmdbImage,
  titleKey,
  whoCanWatch,
  type CountryAvailability,
  type Provider,
  type ProviderKind,
  type TitleRef,
  type Watcher,
} from "@/lib/watch";
import { ListPanel } from "./list-panel";

export const metadata = { title: "Where to watch · Two Couches" };

export default function TitlePage({ params }: PageProps<"/title/[type]/[id]">) {
  return (
    <Suspense fallback={<PageLoading />}>
      <TitleView params={params} />
    </Suspense>
  );
}

async function TitleView({ params }: Pick<PageProps<"/title/[type]/[id]">, "params">) {
  const [{ type, id }, profile, { language, t }] = await Promise.all([params, requireProfile(), getI18n()]);
  const tmdbId = Number(id);
  if (!isMediaType(type) || !Number.isSafeInteger(tmdbId) || tmdbId <= 0) notFound();
  if (!profile.country) redirect("/settings?welcome=1");

  const ref: TitleRef = { media_type: type, tmdb_id: tmdbId };
  const title = await getTitle(ref, tmdbLocale(profile.language, profile.country));
  if (!title) notFound();

  const facts = [
    title.release_date?.slice(0, 4),
    t.common.mediaType[type],
    title.seasons ? t.title.seasons(title.seasons) : null,
    title.runtime
      ? type === "tv"
        ? t.title.episodeRuntime(t.title.runtime(title.runtime))
        : t.title.runtime(title.runtime)
      : null,
    title.genres.join(", ") || null,
  ].filter(Boolean);

  return (
    <div className="grid gap-8">
      <div className="flex flex-col gap-5 sm:flex-row">
        <Poster path={title.poster_path} title={title.title} size="lg" language={language} />
        <div className="grid content-start gap-3">
          <div className="grid gap-1">
            <h1 className="font-display text-3xl font-bold leading-tight tracking-tight">{title.title}</h1>
            {title.original_title !== title.title && <p className="text-muted">{title.original_title}</p>}
            <p className="text-sm text-muted">{facts.join(" · ")}</p>
          </div>
          {title.tagline && <p className="italic text-muted">{title.tagline}</p>}
          {title.overview && <p>{title.overview}</p>}
          {(title.trailer_key || profile.couple_id) && (
            <div className="flex flex-wrap gap-2">
              {title.trailer_key && (
                <a
                  href={`https://www.youtube.com/watch?v=${title.trailer_key}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-quiet"
                >
                  {t.title.trailer}
                </a>
              )}
              {profile.couple_id && (
                <Link href={`/watch-nights/new?type=${type}&id=${tmdbId}`} className="btn-quiet">
                  {t.nights.plan}
                </Link>
              )}
            </div>
          )}
        </div>
      </div>

      {profile.couple_id && (
        <Suspense>
          <OnOurList titleRef={ref} seasons={title.seasons} />
          <ListSync coupleId={profile.couple_id} />
        </Suspense>
      )}

      <Suspense fallback={<p className="text-muted">{t.title.checking}</p>}>
        <WhereToWatch titleRef={ref} />
      </Suspense>
    </div>
  );
}

async function OnOurList({ titleRef, seasons }: { titleRef: TitleRef; seasons: number | null }) {
  const [profile, partner, { t }] = await Promise.all([requireProfile(), getPartner(), getI18n()]);
  const coupleId = profile.couple_id!;
  const [item, categories, dismissed] = await Promise.all([
    getListItem(coupleId, titleRef),
    getCategories(coupleId),
    getDismissedKeys(coupleId),
  ]);

  return (
    <div className="grid gap-3">
      <ListPanel
        titleRef={titleRef}
        seasons={seasons}
        item={item}
        categories={categories}
        me={{ id: profile.id, name: profile.display_name || t.common.you }}
        partner={partner && { id: partner.id, name: partner.display_name || t.common.yourPartner }}
        language={profile.language}
        timeZone={profile.time_zone}
      />
      {!item && (
        <DismissButton titleRef={titleRef} dismissed={dismissed.has(titleKey(titleRef))} language={profile.language} long />
      )}
    </div>
  );
}

async function WhereToWatch({ titleRef }: { titleRef: TitleRef }) {
  const [profile, partner, { t }] = await Promise.all([requireProfile(), getPartner(), getI18n()]);
  const me: Watcher = { country: profile.country!, services: profile.services };
  const them: Watcher | null = partner?.country ? { country: partner.country, services: partner.services } : null;
  const partnerName = partner?.display_name || t.common.yourPartner;

  const [byTitle, reminded] = await Promise.all([
    getAvailability([titleRef], them ? [me.country, them.country] : [me.country]),
    profile.couple_id ? getReminderKeys(profile.couple_id) : null,
  ]);
  const availability = byTitle[titleKey(titleRef)] ?? {};
  const { verdict, mine, theirs } = whoCanWatch(me, them, availability);
  const names = (providers: Provider[]) => providers.map((p) => p.name).join(", ");
  const theirCountry = them ? countryName(them.country, profile.language) : "";

  const text = t.title.banner;
  const banner = {
    both: {
      heading: text.both.heading,
      detail: text.both.detail(names(mine), partnerName, names(theirs)),
      style: "border-both bg-both-soft",
    },
    me: {
      heading: them ? text.me.heading : text.me.headingAlone,
      detail: them ? text.me.detail(names(mine), partnerName, theirCountry) : text.me.detailAlone(names(mine)),
      style: "border-me bg-me-soft",
    },
    partner: {
      heading: text.partner.heading(partnerName),
      detail: text.partner.detail(partnerName, names(theirs), countryName(me.country, profile.language)),
      style: "border-partner bg-partner-soft",
    },
    free: {
      heading: t.common.watchBadge.free,
      detail: them ? text.free.detail : text.free.detailAlone,
      style: "border-line bg-surface",
    },
    none: {
      heading: them ? text.none.heading : text.none.headingAlone,
      detail: text.none.detail,
      style: "border-line bg-surface",
    },
  }[verdict];

  return (
    <section className="grid gap-4">
      <h2 className="font-display text-2xl font-bold tracking-tight">{t.title.whereToWatch}</h2>
      <div className={`grid gap-1 rounded-xl border-2 p-4 ${banner.style}`}>
        <p className="font-display text-lg font-semibold">
          {verdict === "both" && (
            <span aria-hidden className="text-both">
              ●{" "}
            </span>
          )}
          {banner.heading}
        </p>
        <p className="text-sm">{banner.detail}</p>
      </div>
      {reminded && verdict !== "both" && (
        <RemindButton titleRef={titleRef} reminded={reminded.has(titleKey(titleRef))} language={profile.language} long />
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <CountryColumn
          who={t.common.you}
          isMe
          watcher={me}
          availability={availability[me.country]}
          language={profile.language}
          timeZone={profile.time_zone}
          t={t}
        />
        {them && (
          <CountryColumn
            who={partnerName}
            isMe={false}
            watcher={them}
            availability={availability[them.country]}
            language={profile.language}
            timeZone={profile.time_zone}
            t={t}
          />
        )}
      </div>
    </section>
  );
}

/** Provider kinds in the order they're listed. */
const KINDS: ProviderKind[] = ["flatrate", "free", "ads", "rent", "buy"];

function CountryColumn(props: {
  who: string;
  isMe: boolean;
  watcher: Watcher;
  availability: CountryAvailability | undefined;
  language: string;
  timeZone: string;
  t: Messages;
}) {
  const { watcher, availability, isMe, t } = props;
  const country = countryName(watcher.country, props.language);
  const groups = KINDS.map((kind) => ({
    kind,
    providers: availability?.providers.filter((p) => p.kind === kind) ?? [],
  })).filter((g) => g.providers.length > 0);
  const paidStyle = isMe ? "border-me bg-me-soft" : "border-partner bg-partner-soft";

  return (
    <section className="card grid content-start gap-4">
      <div className="flex items-center gap-2">
        <h3 className="font-display text-lg font-semibold">{props.who}</h3>
        <CountryChip code={watcher.country} name={country} isMe={isMe} />
        <span className="text-sm text-muted">{country}</span>
      </div>

      {!availability ? (
        <p className="text-sm text-muted">{t.title.couldntCheck(country)}</p>
      ) : groups.length === 0 ? (
        <p className="text-sm text-muted">{t.title.notAvailable(country)}</p>
      ) : (
        groups.map(({ kind, providers }) => (
          <div key={kind} className="grid gap-2">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted">{t.title.kinds[kind]}</h4>
            <ul className="flex flex-wrap gap-2">
              {providers.map((p) => {
                const pays = kind === "flatrate" && watcher.services.includes(p.provider_id);
                return (
                  <li
                    key={p.provider_id}
                    className={`flex items-center gap-2 rounded-lg border p-1.5 pr-2.5 text-sm ${pays ? `${paidStyle} font-semibold` : "border-line"}`}
                    title={pays ? (isMe ? t.title.youPay(p.name) : t.title.theyPay(props.who, p.name)) : undefined}
                  >
                    {p.logo_path && (
                      <Image
                        src={tmdbImage(p.logo_path, "w92")}
                        alt=""
                        width={24}
                        height={24}
                        unoptimized
                        className="rounded"
                      />
                    )}
                    {p.name}
                    {pays && <span aria-label={isMe ? t.title.youPayLabel : t.title.theyPayLabel}>✓</span>}
                  </li>
                );
              })}
            </ul>
          </div>
        ))
      )}

      {availability && (
        <p className="text-xs text-muted">
          {t.title.checked(
            new Intl.DateTimeFormat(props.language, {
              day: "numeric",
              month: "short",
              hour: "numeric",
              minute: "2-digit",
              timeZone: props.timeZone,
            }).format(new Date(availability.checked_at)),
          )}
          {availability.link && (
            <>
              {" · "}
              <a href={availability.link} target="_blank" rel="noopener noreferrer" className="underline">
                {t.title.justWatch}
              </a>
            </>
          )}
        </p>
      )}
    </section>
  );
}
