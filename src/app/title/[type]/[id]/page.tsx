import Image from "next/image";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { CountryChip } from "@/components/country-chip";
import { ListSync } from "@/components/list-sync";
import { Poster } from "@/components/poster";
import { getCategories, getListItem } from "@/lib/list";
import { countryName } from "@/lib/places";
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
    <Suspense fallback={<p className="text-muted">Loading…</p>}>
      <TitleView params={params} />
    </Suspense>
  );
}

function formatRuntime(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h ? `${h} h${m ? ` ${m} min` : ""}` : `${m} min`;
}

async function TitleView({ params }: Pick<PageProps<"/title/[type]/[id]">, "params">) {
  const [{ type, id }, profile] = await Promise.all([params, requireProfile()]);
  const tmdbId = Number(id);
  if (!isMediaType(type) || !Number.isSafeInteger(tmdbId) || tmdbId <= 0) notFound();
  if (!profile.country) redirect("/settings?welcome=1");

  const ref: TitleRef = { media_type: type, tmdb_id: tmdbId };
  const title = await getTitle(ref, tmdbLocale(profile.language, profile.country));
  if (!title) notFound();

  const facts = [
    title.release_date?.slice(0, 4),
    type === "movie" ? "Film" : "Series",
    title.seasons ? `${title.seasons} season${title.seasons === 1 ? "" : "s"}` : null,
    title.runtime ? formatRuntime(title.runtime) + (type === "tv" ? " episodes" : "") : null,
    title.genres.join(", ") || null,
  ].filter(Boolean);

  return (
    <div className="grid gap-8">
      <div className="flex flex-col gap-5 sm:flex-row">
        <Poster path={title.poster_path} title={title.title} size="lg" />
        <div className="grid content-start gap-3">
          <div className="grid gap-1">
            <h1 className="font-display text-3xl font-bold leading-tight tracking-tight">{title.title}</h1>
            {title.original_title !== title.title && <p className="text-muted">{title.original_title}</p>}
            <p className="text-sm text-muted">{facts.join(" · ")}</p>
          </div>
          {title.tagline && <p className="italic text-muted">{title.tagline}</p>}
          {title.overview && <p>{title.overview}</p>}
          {title.trailer_key && (
            <a
              href={`https://www.youtube.com/watch?v=${title.trailer_key}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-quiet justify-self-start"
            >
              Watch the trailer ↗
            </a>
          )}
        </div>
      </div>

      {profile.couple_id && (
        <Suspense>
          <OnOurList titleRef={ref} seasons={title.seasons} />
          <ListSync coupleId={profile.couple_id} />
        </Suspense>
      )}

      <Suspense fallback={<p className="text-muted">Checking where you can watch it…</p>}>
        <WhereToWatch titleRef={ref} />
      </Suspense>
    </div>
  );
}

async function OnOurList({ titleRef, seasons }: { titleRef: TitleRef; seasons: number | null }) {
  const [profile, partner] = await Promise.all([requireProfile(), getPartner()]);
  const coupleId = profile.couple_id!;
  const [item, categories] = await Promise.all([getListItem(coupleId, titleRef), getCategories(coupleId)]);

  return (
    <ListPanel
      titleRef={titleRef}
      seasons={seasons}
      item={item}
      categories={categories}
      me={{ id: profile.id, name: profile.display_name || "You" }}
      partner={partner && { id: partner.id, name: partner.display_name || "Your partner" }}
      language={profile.language}
      timeZone={profile.time_zone}
    />
  );
}

async function WhereToWatch({ titleRef }: { titleRef: TitleRef }) {
  const [profile, partner] = await Promise.all([requireProfile(), getPartner()]);
  const me: Watcher = { country: profile.country!, services: profile.services };
  const them: Watcher | null = partner?.country ? { country: partner.country, services: partner.services } : null;
  const partnerName = partner?.display_name || "Your partner";

  const availability =
    (await getAvailability([titleRef], them ? [me.country, them.country] : [me.country]))[titleKey(titleRef)] ?? {};
  const { verdict, mine, theirs } = whoCanWatch(me, them, availability);
  const names = (providers: Provider[]) => providers.map((p) => p.name).join(", ");
  const theirCountry = them ? countryName(them.country, profile.language) : "";

  const banner = {
    both: {
      heading: "You can both watch this",
      detail: `You on ${names(mine)}, ${partnerName} on ${names(theirs)}.`,
      style: "border-both bg-both-soft",
    },
    me: {
      heading: them ? "Only you can stream this" : "You can stream this",
      detail: them
        ? `You have it on ${names(mine)}. None of ${partnerName}'s services carry it in ${theirCountry}.`
        : `On ${names(mine)}.`,
      style: "border-me bg-me-soft",
    },
    partner: {
      heading: `Only ${partnerName} can stream this`,
      detail: `${partnerName} has it on ${names(theirs)}. None of your services carry it in ${countryName(me.country, profile.language)}.`,
      style: "border-partner bg-partner-soft",
    },
    free: {
      heading: "Free to watch",
      detail: them ? "Neither of you pays for a service with it, but it's free in both countries." : "It's free to stream.",
      style: "border-line bg-surface",
    },
    none: {
      heading: them ? "Neither of you can stream this yet" : "Not on your services",
      detail: "It isn't on a service you pay for. Renting or buying it may still be an option below.",
      style: "border-line bg-surface",
    },
  }[verdict];

  return (
    <section className="grid gap-4">
      <h2 className="font-display text-2xl font-bold tracking-tight">Where to watch</h2>
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
      <div className="grid gap-3 sm:grid-cols-2">
        <CountryColumn
          who="You"
          isMe
          watcher={me}
          availability={availability[me.country]}
          language={profile.language}
          timeZone={profile.time_zone}
        />
        {them && (
          <CountryColumn
            who={partnerName}
            isMe={false}
            watcher={them}
            availability={availability[them.country]}
            language={profile.language}
            timeZone={profile.time_zone}
          />
        )}
      </div>
    </section>
  );
}

const KIND_LABELS: Record<ProviderKind, string> = {
  flatrate: "Subscription",
  free: "Free",
  ads: "Free with ads",
  rent: "Rent",
  buy: "Buy",
};

function CountryColumn(props: {
  who: string;
  isMe: boolean;
  watcher: Watcher;
  availability: CountryAvailability | undefined;
  language: string;
  timeZone: string;
}) {
  const { watcher, availability, isMe } = props;
  const country = countryName(watcher.country, props.language);
  const groups = (Object.keys(KIND_LABELS) as ProviderKind[])
    .map((kind) => ({ kind, providers: availability?.providers.filter((p) => p.kind === kind) ?? [] }))
    .filter((g) => g.providers.length > 0);
  const paidStyle = isMe ? "border-me bg-me-soft" : "border-partner bg-partner-soft";

  return (
    <section className="card grid content-start gap-4">
      <div className="flex items-center gap-2">
        <h3 className="font-display text-lg font-semibold">{props.who}</h3>
        <CountryChip code={watcher.country} name={country} isMe={isMe} />
        <span className="text-sm text-muted">{country}</span>
      </div>

      {!availability ? (
        <p className="text-sm text-muted">Couldn&apos;t check {country} right now. Try again shortly.</p>
      ) : groups.length === 0 ? (
        <p className="text-sm text-muted">Not available to stream, rent or buy in {country}.</p>
      ) : (
        groups.map(({ kind, providers }) => (
          <div key={kind} className="grid gap-2">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted">{KIND_LABELS[kind]}</h4>
            <ul className="flex flex-wrap gap-2">
              {providers.map((p) => {
                const pays = kind === "flatrate" && watcher.services.includes(p.provider_id);
                return (
                  <li
                    key={p.provider_id}
                    className={`flex items-center gap-2 rounded-lg border p-1.5 pr-2.5 text-sm ${pays ? `${paidStyle} font-semibold` : "border-line"}`}
                    title={pays ? `${isMe ? "You pay" : `${props.who} pays`} for ${p.name}` : undefined}
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
                    {pays && <span aria-label={isMe ? "you pay for this" : "they pay for this"}>✓</span>}
                  </li>
                );
              })}
            </ul>
          </div>
        ))
      )}

      {availability && (
        <p className="text-xs text-muted">
          Checked{" "}
          {new Intl.DateTimeFormat(props.language, {
            day: "numeric",
            month: "short",
            hour: "numeric",
            minute: "2-digit",
            timeZone: props.timeZone,
          }).format(new Date(availability.checked_at))}
          {availability.link && (
            <>
              {" · "}
              <a href={availability.link} target="_blank" rel="noopener noreferrer" className="underline">
                Data from JustWatch via TMDB
              </a>
            </>
          )}
        </p>
      )}
    </section>
  );
}
