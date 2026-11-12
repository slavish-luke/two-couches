"use client";

import { useState, useSyncExternalStore, type ReactNode } from "react";
import { getMessages, LANGUAGES } from "@/lib/i18n";
import { googleTranslateUrl, sameLanguage, sourceLanguage } from "@/lib/shelf-rules";
import { TranslateIcon } from "./icons";

// The browser's own Translator and LanguageDetector (desktop Chrome and Edge). Not in TypeScript's DOM types
// yet, and missing in most browsers, so they're always feature-detected.
type Translator = { translate(text: string): Promise<string> };
type TranslatorApi = {
  availability(options: { sourceLanguage: string; targetLanguage: string }): Promise<string>;
  create(options: { sourceLanguage: string; targetLanguage: string }): Promise<Translator>;
};
type Detector = { detect(text: string): Promise<{ detectedLanguage?: string; confidence?: number }[]> };
type DetectorApi = { create(): Promise<Detector> };

function browserApis() {
  const g = globalThis as unknown as { Translator?: TranslatorApi; LanguageDetector?: DetectorApi };
  return { translator: g.Translator ?? null, detector: g.LanguageDetector ?? null };
}

// One translator per language pair and one detector for the page, made on first use (creating one can
// download a language model, which needs the tap that asked for it).
const translators = new Map<string, Promise<Translator>>();
let detector: Promise<Detector> | null = null;

async function detect(text: string) {
  const api = browserApis().detector;
  if (!api) return null;
  try {
    detector ??= api.create();
    return await (await detector).detect(text);
  } catch {
    detector = null;
    return null;
  }
}

/** "same" when it's already in the target language; null when the browser can't do this pair. */
async function translate(text: string, target: string): Promise<string | "same" | null> {
  const api = browserApis().translator;
  if (!api) return null;
  const source = sourceLanguage(await detect(text), target, Object.keys(LANGUAGES));
  if (sameLanguage(source, target)) return "same";
  const pair = { sourceLanguage: source, targetLanguage: target };
  if ((await api.availability(pair)) === "unavailable") return null;
  const key = `${source}>${target}`;
  let made = translators.get(key);
  if (!made) {
    made = api.create(pair);
    translators.set(key, made);
    made.catch(() => translators.delete(key));
  }
  return (await made).translate(text);
}

/** The browser's APIs don't come and go while the page is open. */
function noSubscription() {
  return () => {};
}

type Phase = "idle" | "working" | "shown" | "same" | "failed";

/**
 * Your partner's words with a "Translate" control after them, into your UI language. Where the browser has
 * a Translator (desktop Chrome and Edge) the text swaps in place, with "Show original" to swap back;
 * elsewhere, or when it can't do the pair, a link opens Google Translate with the text. Nothing goes
 * through our server. `children` draws the text (the original or the translation) in its own element.
 */
export function Translatable({
  text,
  language,
  children,
  compact = false,
  className = "",
}: {
  text: string;
  language: string;
  children: (shown: string) => ReactNode;
  /** Smaller, for chat lines. */
  compact?: boolean;
  className?: string;
}) {
  const t = getMessages(language).shelf.translate;
  // The server can't know, so the first paint is the link; it becomes a button once we know the browser can.
  const hasApi = useSyncExternalStore(noSubscription, () => Boolean(browserApis().translator), () => false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [translation, setTranslation] = useState<string | null>(null);
  // A changed text (edited on the other screen) starts again from the original.
  const [forText, setForText] = useState(text);
  if (forText !== text) {
    setForText(text);
    setTranslation(null);
    setPhase("idle");
  }

  const size = compact ? "text-xs" : "text-sm";
  const link = (label: string) => (
    <a
      href={googleTranslateUrl(text, language)}
      target="_blank"
      rel="noopener noreferrer"
      title={t.google}
      className="tap-area inline-flex items-center gap-1 font-bold underline underline-offset-4"
    >
      <TranslateIcon className="size-[1.15em]" />
      {label}
    </a>
  );

  function onTap() {
    if (phase === "shown") return setPhase("idle");
    if (translation) return setPhase("shown");
    setPhase("working");
    translate(text, language)
      .then((result) => {
        if (result === "same") return setPhase("same");
        if (result === null) return setPhase("failed");
        setTranslation(result);
        setPhase("shown");
      })
      .catch((error) => {
        console.error("Translating failed", error);
        setPhase("failed");
      });
  }

  return (
    <>
      {children(phase === "shown" && translation ? translation : text)}
      <span data-translate className={`flex flex-wrap items-center gap-x-3 gap-y-0.5 ${size} ${className}`} aria-live="polite">
        {!hasApi ? (
          link(t.button)
        ) : phase === "failed" ? (
          <>
            <span className="font-semibold text-muted">{t.failed}</span>
            {link(t.google)}
          </>
        ) : (
          <button
            type="button"
            onClick={onTap}
            disabled={phase === "working"}
            className="tap-area inline-flex items-center gap-1 font-bold underline underline-offset-4 disabled:opacity-60"
          >
            <TranslateIcon className="size-[1.15em]" />
            {phase === "working" ? t.translating : phase === "shown" ? t.original : t.button}
          </button>
        )}
        {phase === "shown" && <span className="font-semibold text-muted">{t.byBrowser}</span>}
        {phase === "same" && <span className="font-semibold text-muted">{t.same}</span>}
      </span>
    </>
  );
}

/** Translatable for server components, which can't pass a function: the text in a `<p>` with these classes. */
export function TranslatedText({
  text,
  language,
  className,
  compact,
}: {
  text: string;
  language: string;
  className?: string;
  compact?: boolean;
}) {
  return (
    <Translatable text={text} language={language} compact={compact}>
      {(shown) => <p className={className}>{shown}</p>}
    </Translatable>
  );
}
