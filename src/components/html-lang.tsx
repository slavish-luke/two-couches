"use client";

import { useEffect } from "react";

/**
 * Sets <html lang> to the viewer's UI language. The root layout is static, so it can't read the
 * profile itself. Renders nothing.
 */
export function HtmlLang({ language }: { language: string }) {
  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);
  return null;
}
