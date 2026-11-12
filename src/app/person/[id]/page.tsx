import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { Couches } from "@/components/couch";
import { ListSync } from "@/components/list-sync";
import { PersonPhoto } from "@/components/person-photo";
import { posterMorph } from "@/components/poster";
import { TitleCard, type CardContext } from "@/components/title-card";
import type { Messages } from "@/lib/i18n";
import { getI18n } from "@/lib/i18n/server";
import { getListKeys } from "@/lib/list";
import { formatDate, isDateString } from "@/lib/list-rules";
import { getPerson } from "@/lib/people";
import { paragraphs, PERSON_FIRST_BATCH, type PersonTitle } from "@/lib/people-rules";
import { getPartner, requireProfile } from "@/lib/session";
import { getAvailability } from "@/lib/titles";
import { tmdbLocale } from "@/lib/tmdb";
import { titleKey, type Watcher } from "@/lib/watch";
import { Biography } from "./biography";
import { PersonSkeleton } from "./skeleton";

function personId(id: string) {
  const n = Number(id);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

/** The person's name as the page title, in the viewer's language for anything else. */
export async function generateMetadata({ params }: PageProps<"/person/[id]">): Promise<Metadata> {
  const [{ id }, profile, { language, t }] = await Promise.all([params, requireProfile(), getI18n()]);
  const n = personId(id);
  const person = n && profile.home_country ? await getPerson(n, tmdbLocale(language, profile.home_country)).catch(() => null) : null;
  return { title: `${person?.name ?? t.people.cast.heading} · ${t.common.appName}` };
}

/**
 * A person's page (Sprint 23), opened from a title page's cast and crew: their photo and biography, then
 * their films and series, best known first, each with who of you can watch it. From TMDB (24 h fetch cache).
 */
export default function PersonPage({ params }: PageProps<"/person/[id]">) {
  return (
    <Suspense fallback={<PersonSkeleton />}>
      <PersonView params={params} />
    </Suspense>
  );
}

async function PersonView({ params }: Pick<PageProps<"/person/[id]">, "params">) {
  const [{ id }, profile, partner, { language, t }] = await Promise.all([params, requireProfile(), getPartner(), getI18n()]);
  const n = personId(id);
  if (!n) notFound();
  if (!profile.country) redirect("/settings?welcome=1");
  const text = t.people.person;

  let person: Awaited<ReturnType<typeof getPerson>>;
  try {
    person = await getPerson(n, tmdbLocale(profile.language, profile.home_country));
  } catch (error) {
    console.error("Loading a person failed", error);
    return (
      <div className="card grid justify-items-center gap-3 px-6 py-10 text-center">
        <Couches size={56} />
        <p role="alert" className="font-semibold text-danger">
          {text.failed}
        </p>
      </div>
    );
  }
  if (!person) notFound();

  const me: Watcher = { country: profile.country, services: profile.services };
  const them: Watcher | null = partner?.country ? { country: partner.country, services: partner.services } : null;
  const countries = them ? [me.country, them.country] : [me.country];
  // getAvailability() checks at most 20 titles at once against TMDB: the first cards get theirs first, and
  // the rest are asked for after them, so a cold cache doesn't hold every tab up.
  const first = person.titles.slice(0, PERSON_FIRST_BATCH);
  const rest = person.titles.slice(PERSON_FIRST_BATCH);
  const firstBatch = getAvailability(first, countries);
  const restBatch = rest.length ? firstBatch.catch(() => ({})).then(() => getAvailability(rest, countries)) : firstBatch;
  const onList = profile.couple_id ? await getListKeys(profile.couple_id) : null;
  const context = (availability: CardContext["availability"]): CardContext => ({
    language,
    availability,
    me,
    them,
    partnerName: partner?.display_name || t.common.yourPartner,
    onList,
  });
  const contexts = { first: context(firstBatch), rest: context(restBatch) };

  const bio = paragraphs(person.biography);
  const date = (value: string | null) => (value && isDateString(value) ? formatDate(value, language) : null);
  const born = date(person.birthday);
  const facts = [
    person.known_for ? (text.knownFor[person.known_for as keyof typeof text.knownFor] ?? null) : null,
    born && person.place_of_birth
      ? text.bornIn(born, person.place_of_birth)
      : born
        ? text.born(born)
        : person.place_of_birth
          ? text.bornPlace(person.place_of_birth)
          : null,
    date(person.deathday) && text.died(date(person.deathday)!),
  ].filter(Boolean);

  return (
    <div className="grid gap-12">
      {profile.couple_id && <ListSync coupleId={profile.couple_id} />}
      <div className="grid gap-x-9 gap-y-6 sm:grid-cols-[auto_minmax(0,1fr)]">
        <div className="w-[200px] justify-self-center sm:w-[240px] sm:justify-self-start">
          <PersonPhoto
            path={person.profile_path}
            name={person.name}
            size="page"
            alt={text.photo(person.name)}
            eager
            className="-rotate-2 shadow-[7px_7px_0_var(--outline)]"
          />
        </div>
        <div className="grid min-w-0 content-start gap-4">
          <div className="grid gap-2">
            <h1 className="display text-[clamp(2.4rem,5vw,3.6rem)] [overflow-wrap:anywhere]">{person.name}</h1>
            {facts.length > 0 && <p className="font-bold">{facts.join(" · ")}</p>}
          </div>
          {bio.length > 0 ? (
            <>
              <Biography paragraphs={bio} language={language} />
              {person.biographyInEnglish && <p className="text-sm text-muted">{text.inEnglish}</p>}
            </>
          ) : (
            <p className="font-medium text-muted">{text.noBiography}</p>
          )}
        </div>
      </div>

      <section aria-labelledby="person-titles" className="grid gap-3">
        <h2 id="person-titles" className="display text-[2rem]">
          {text.titles}
        </h2>
        {person.titles.length === 0 ? (
          <p className="font-medium text-muted">{text.noTitles}</p>
        ) : (
          <>
            <p className="font-medium text-muted">{text.titlesNote}</p>
            <ul className="grid grid-cols-2 gap-x-5 gap-y-8 pt-3 sm:grid-cols-3 md:grid-cols-4">
              {person.titles.map((title, i) => (
                <TitleCard
                  key={titleKey(title)}
                  result={title}
                  context={i < PERSON_FIRST_BATCH ? contexts.first : contexts.rest}
                  index={i}
                  eager={i < 4}
                  morph={posterMorph(title)}
                  details={<Details title={title} t={t} />}
                />
              ))}
            </ul>
          </>
        )}
      </section>
    </div>
  );
}

/** Under a title: the year and what it is, then what they did on it ("as Walter White", "Director"). */
function Details({ title, t }: { title: PersonTitle; t: Messages }) {
  const did = [
    ...(title.characters.length ? [t.people.cast.as(title.characters.join(", "))] : []),
    ...title.departments.map((d) => t.people.person.did[d]),
  ].join(" · ");
  return (
    <>
      <span className="text-sm font-medium text-muted">
        {[title.release_date?.slice(0, 4), t.common.mediaType[title.media_type]].filter(Boolean).join(" · ")}
      </span>
      {did && <span className="line-clamp-2 text-sm text-muted">{did}</span>}
    </>
  );
}
