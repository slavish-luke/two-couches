/**
 * How the app looks on this device: a "skin" (Look in Settings: its fonts, shapes, decorations and motion)
 * and one of that skin's palettes (Colours). Both are kept in localStorage and set on <html> as data-skin
 * and data-palette before the first paint. Saturday Morning with its Sunburst palette is the standard
 * look (nothing stored). Pure apart from applyLook(), which only runs in the browser.
 */

/** Each skin and its palettes, the first being the skin's standard one. */
export const SKINS = {
  saturday: ["sunburst", "pool", "lime", "grape", "tangerine", "bubblegum", "sky", "nightowl"],
  candy: ["cdy-strawberry", "cdy-mint", "cdy-midnight"],
} as const satisfies Record<string, readonly string[]>;

export type Skin = keyof typeof SKINS;
export type Palette = (typeof SKINS)[Skin][number];
export type Look = { skin: Skin; palette: Palette };

export const DEFAULT_LOOK: Look = { skin: "saturday", palette: "sunburst" };

const STORAGE_KEY = "look";
/** The intro plays once per app launch; this sessionStorage key marks it played (src/components/intro.tsx). */
export const INTRO_KEY = "intro-played";

/**
 * Each palette's page ground (for the browser toolbar and the manifest) and the colours Settings uses to
 * draw its swatch.
 */
export const PALETTE_COLORS = {
  sunburst: { ground: "#ffd23f", paper: "#fffaf0", ink: "#1d1a2b", accent: "#6a4cf5", both: "#ff2e93", me: "#ff8a65", partner: "#5cc8ff" },
  pool: { ground: "#4fd6e4", paper: "#fffaf0", ink: "#1d1a2b", accent: "#b82a18", both: "#ff2e93", me: "#ffa04d", partner: "#c3a1ff" },
  lime: { ground: "#b8ef45", paper: "#fffaf0", ink: "#1d1a2b", accent: "#2440c9", both: "#ff2e93", me: "#ff8a3d", partner: "#5cc8ff" },
  grape: { ground: "#a389ff", paper: "#fffaf0", ink: "#1d1a2b", accent: "#ff8a1f", both: "#a8f02e", me: "#ffe14d", partner: "#ff9ccd" },
  tangerine: { ground: "#ff9d42", paper: "#fffaf0", ink: "#1d1a2b", accent: "#1d5fc2", both: "#ff2e93", me: "#9be34a", partner: "#5cc8ff" },
  bubblegum: { ground: "#ff9ccd", paper: "#fffaf0", ink: "#1d1a2b", accent: "#6a4cf5", both: "#a8f02e", me: "#ffb03a", partner: "#5cc8ff" },
  sky: { ground: "#7cc9ff", paper: "#fffaf0", ink: "#1d1a2b", accent: "#b52219", both: "#ff2e93", me: "#ff8a65", partner: "#9be34a" },
  nightowl: { ground: "#272056", paper: "#f6eddc", ink: "#0e0b1f", accent: "#ff9a3d", both: "#ff3d9a", me: "#ff8a65", partner: "#5cc8ff" },
  "cdy-strawberry": { ground: "#fff1f8", paper: "#ffffff", ink: "#2b124c", accent: "#6c3cef", both: "#c8f53b", me: "#ffb0d6", partner: "#9fe3ff" },
  "cdy-mint": { ground: "#e6fbf1", paper: "#ffffff", ink: "#2b124c", accent: "#5c3a26", both: "#ff4fa3", me: "#ffb36b", partner: "#b9a4ff" },
  "cdy-midnight": { ground: "#22103d", paper: "#fff8fc", ink: "#14072a", accent: "#ff5fae", both: "#c8f53b", me: "#ff9ccc", partner: "#7fdcff" },
} as const satisfies Record<Palette, Record<"ground" | "paper" | "ink" | "accent" | "both" | "me" | "partner", string>>;

const GROUNDS = Object.fromEntries(Object.entries(PALETTE_COLORS).map(([palette, colors]) => [palette, colors.ground]));

function parseLook(value: string | null): Look {
  const [skin, palette] = (value ?? "").split("/");
  if (skin && skin in SKINS) {
    const palettes: readonly string[] = SKINS[skin as Skin];
    return { skin: skin as Skin, palette: (palettes.includes(palette ?? "") ? palette : palettes[0]) as Palette };
  }
  return DEFAULT_LOOK;
}

/**
 * Runs in <head> before the first paint, so a saved look never flashes another one, and points the
 * theme-color tag at its ground. It also asks for the opening animation (data-intro) once per browser
 * session unless the device asks for reduced motion. Keep in step with parseLook() and applyLook().
 */
export const LOOK_SCRIPT = `(function(){try{var d=document.documentElement,s=${JSON.stringify(SKINS)},g=${JSON.stringify(GROUNDS)};localStorage.removeItem("theme");var v=(localStorage.getItem("${STORAGE_KEY}")||"").split("/");if(s[v[0]]){d.setAttribute("data-skin",v[0]);d.setAttribute("data-palette",s[v[0]].indexOf(v[1])>=0?v[1]:s[v[0]][0])}var p=d.getAttribute("data-palette");document.addEventListener("DOMContentLoaded",function(){document.querySelectorAll('meta[name="theme-color"]').forEach(function(m){m.setAttribute("content",g[p])})});if(!sessionStorage.getItem("${INTRO_KEY}")&&!matchMedia("(prefers-reduced-motion: reduce)").matches)d.setAttribute("data-intro","")}catch(e){}})()`;

export function savedLook(): Look {
  try {
    return parseLook(localStorage.getItem(STORAGE_KEY));
  } catch {
    return DEFAULT_LOOK;
  }
}

/** Switches this device to a look straight away and remembers it. */
export function applyLook(look: Look) {
  const root = document.documentElement;
  try {
    if (look.skin === DEFAULT_LOOK.skin && look.palette === DEFAULT_LOOK.palette) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, `${look.skin}/${look.palette}`);
  } catch {
    // Private browsing can refuse storage; the look still applies until the page reloads.
  }
  root.setAttribute("data-skin", look.skin);
  root.setAttribute("data-palette", look.palette);
  for (const meta of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) {
    meta.setAttribute("content", PALETTE_COLORS[look.palette].ground);
  }
}
