import "server-only";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { cache } from "react";
import { getCurrentProfile } from "../session";
import { getMessages, pickLanguage, type Messages } from ".";

/**
 * The viewer's UI language and text: their profile's language when signed in, else the browser's
 * Accept-Language. Reads the session or headers, so call it inside a <Suspense> boundary. Memoised per request.
 */
export const getI18n = cache(async () => {
  const profile = await getCurrentProfile();
  const language = profile?.language ?? pickLanguage((await headers()).get("accept-language"));
  return { language, t: getMessages(language) };
});

/**
 * A page's generateMetadata: its <title> in the viewer's language, e.g. "Browse · Two Couches". Reads the
 * session, so the title streams in at request time like the page's own content.
 */
export function localisedTitle(key: keyof Messages["common"]["pageTitles"]) {
  return async (): Promise<Metadata> => {
    const { t } = await getI18n();
    return { title: `${t.common.pageTitles[key]} · ${t.common.appName}` };
  };
}
