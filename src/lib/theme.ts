/**
 * Light or dark, chosen per device in Settings and kept in localStorage ("system" removes it). Pure apart
 * from applyTheme(), which only runs in the browser.
 */

export const THEMES = ["system", "light", "dark"] as const;

export type Theme = (typeof THEMES)[number];

const STORAGE_KEY = "theme";

/** The page background in each theme, for the browser's toolbar (<meta name="theme-color">). */
export const THEME_COLORS = { light: "#f5f7f8", dark: "#0f1418" } as const;

/**
 * Runs in <head> before the first paint, so a saved theme never flashes the other one. Also points the
 * theme-color tags at the saved theme once they're parsed. Keep in step with applyTheme().
 */
export const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem("${STORAGE_KEY}");if(t!=="light"&&t!=="dark")return;document.documentElement.setAttribute("data-theme",t);document.addEventListener("DOMContentLoaded",function(){document.querySelectorAll('meta[name="theme-color"]').forEach(function(m){m.setAttribute("content",t==="dark"?"${THEME_COLORS.dark}":"${THEME_COLORS.light}")})})}catch(e){}})()`;

export function isTheme(value: unknown): value is Theme {
  return typeof value === "string" && (THEMES as readonly string[]).includes(value);
}

export function savedTheme(): Theme {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === "light" || value === "dark" ? value : "system";
  } catch {
    return "system";
  }
}

/** Switches this device to a theme straight away and remembers it. */
export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  try {
    if (theme === "system") localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Private browsing can refuse storage; the theme still applies until the page reloads.
  }
  if (theme === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", theme);
  // The tags carry media queries for "system"; a fixed theme overrides both.
  for (const meta of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) {
    const media = meta.getAttribute("media") ?? "";
    const forScheme = theme === "system" ? (media.includes("dark") ? "dark" : "light") : theme;
    meta.setAttribute("content", THEME_COLORS[forScheme]);
  }
}
