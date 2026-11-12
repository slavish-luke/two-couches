/**
 * UI text in every supported language (LANGUAGES in places.ts). Pure, safe in server and client code.
 * Server components use getI18n() from ./server; client components take a `language` prop and call
 * getMessages(language).
 *
 * Each namespace file exports `{ en, tr }`, where `tr` is typed as `typeof en`, so a missing or
 * misspelt key is a type error. Text that varies goes in functions, e.g. `addedBy: (name: string) => …`.
 */
import { isLanguage, LANGUAGES, type Language } from "../places";
import account from "./account";
import browse from "./browse";
import common from "./common";
import diary from "./diary";
import discovery from "./discovery";
import list from "./list";
import nights from "./nights";
import people from "./people";
import pick from "./pick";
import places from "./places";
import reviews from "./reviews";
import shelf from "./shelf";
import stats from "./stats";
import title from "./title";
import together from "./together";
import upcoming from "./upcoming";

const dictionaries = {
  en: { common: common.en, list: list.en, title: title.en, account: account.en, browse: browse.en, upcoming: upcoming.en, nights: nights.en, stats: stats.en, pick: pick.en, places: places.en, reviews: reviews.en, diary: diary.en, discovery: discovery.en, together: together.en, people: people.en, shelf: shelf.en },
  tr: { common: common.tr, list: list.tr, title: title.tr, account: account.tr, browse: browse.tr, upcoming: upcoming.tr, nights: nights.tr, stats: stats.tr, pick: pick.tr, places: places.tr, reviews: reviews.tr, diary: diary.tr, discovery: discovery.tr, together: together.tr, people: people.tr, shelf: shelf.tr },
} satisfies Record<Language, unknown>;

export type Messages = (typeof dictionaries)["en"];

/** UI text for a language. Falls back to English for anything unsupported. */
export function getMessages(language: string): Messages {
  return isLanguage(language) ? dictionaries[language] : dictionaries.en;
}

/** The best supported language for an Accept-Language header, for visitors who aren't signed in. */
export function pickLanguage(acceptLanguage: string | null): Language {
  const ranked = (acceptLanguage ?? "")
    .split(",")
    .map((part) => {
      const [tag, ...params] = part.trim().split(";");
      const q = params.map((p) => p.trim()).find((p) => p.startsWith("q="));
      return { language: tag.slice(0, 2).toLowerCase(), q: q ? Number(q.slice(2)) || 0 : 1 };
    })
    .filter((entry) => entry.q > 0)
    .sort((a, b) => b.q - a.q);
  return ranked.map((entry) => entry.language).find(isLanguage) ?? "en";
}

/** "1 film" / "2 films" in English; Turkish nouns don't change after a number. */
export function plural(language: string, count: number, forms: { one: string; other: string }) {
  return new Intl.PluralRules(language).select(count) === "one" ? forms.one : forms.other;
}

export { LANGUAGES };
