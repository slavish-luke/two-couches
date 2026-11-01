import "server-only";
import { headers } from "next/headers";
import { cache } from "react";
import { getCurrentProfile } from "../session";
import { getMessages, pickLanguage } from ".";

/**
 * The viewer's UI language and text: their profile's language when signed in, else the browser's
 * Accept-Language. Reads the session or headers, so call it inside a <Suspense> boundary. Memoised per request.
 */
export const getI18n = cache(async () => {
  const profile = await getCurrentProfile();
  const language = profile?.language ?? pickLanguage((await headers()).get("accept-language"));
  return { language, t: getMessages(language) };
});
