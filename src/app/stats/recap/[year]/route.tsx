/* eslint-disable @next/next/no-img-element -- Satori draws plain <img>; next/image has no meaning in an ImageResponse. */
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { getGenres } from "@/lib/browse";
import { getMessages } from "@/lib/i18n";
import { getList } from "@/lib/list";
import { localDate } from "@/lib/list-rules";
import { isCountry } from "@/lib/places";
import { getCurrentProfile, getPartner } from "@/lib/session";
import { computeStats } from "@/lib/stats-rules";
import { getRewatches } from "@/lib/diary";
import { getNightsAt } from "@/lib/taste";
import { streaks, tasteMatch } from "@/lib/taste-rules";
import { tmdbLocale } from "@/lib/tmdb";
import { tmdbImage } from "@/lib/watch";

/*
 * The year in review as a PNG to keep or share (Stats → "Save 2026 as an image"): the year's numbers, top
 * genre, favourite together, taste match and best streak, drawn on the server with next/og in the Sunburst
 * look, in the viewer's language. Satori can't read CSS variables, so the Sunburst colours are written out
 * here (they match [data-palette="sunburst"] in globals.css), and everything is lettered in Luckiest Guy,
 * which has every Turkish letter (src/app/fonts/README.md).
 */

const SUN = {
  ground: "#ffd23f",
  ray: "#ffc61a",
  paper: "#fffaf0",
  ink: "#1d1a2b",
  muted: "#4a4360",
  me: "#ff8a65",
  partner: "#5cc8ff",
  stamp: "#ff2e93",
  accent: "#6a4cf5",
  pop: "#ffd23f",
  blush: "#ff5c8a",
};

const WIDTH = 1080;
const HEIGHT = 1350;

// Read once per server instance (it never depends on the request).
const font = readFile(join(process.cwd(), "src/app/fonts/recap-luckiest-guy.ttf"));

/** Rays fanning down from above the top edge, like the app's ground. */
const RAYS = (() => {
  const cx = WIDTH / 2;
  const cy = -260;
  const r = 2400;
  const count = 28;
  const wedges = Array.from({ length: count }, (_, i) => {
    const a0 = (i / count) * Math.PI * 2;
    const a1 = a0 + Math.PI / count;
    const p = (a: number) => `${(cx + r * Math.cos(a)).toFixed(0)},${(cy + r * Math.sin(a)).toFixed(0)}`;
    return `<polygon points="${cx},${cy} ${p(a0)} ${p(a1)}" fill="${SUN.ray}"/>`;
  }).join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}">${wedges}</svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
})();

/** The two couches of the logo (CouchShape in src/components/couch.tsx), with Sunburst's colours. */
const COUCHES = (() => {
  const couch = (fill: string, x: number) => `
    <g transform="translate(${x} 0)" stroke="${SUN.ink}" stroke-width="3">
      <rect x="9" y="8" width="46" height="24" rx="9" fill="${fill}"/>
      <rect x="3" y="20" width="14" height="22" rx="6" fill="${fill}"/>
      <rect x="47" y="20" width="14" height="22" rx="6" fill="${fill}"/>
      <rect x="13" y="28" width="38" height="14" rx="5" fill="${fill}"/>
      <path d="M10 42v5M54 42v5" stroke-linecap="round"/>
      <ellipse cx="26" cy="19" rx="2.6" ry="3.4" fill="${SUN.ink}" stroke="none"/>
      <ellipse cx="38" cy="19" rx="2.6" ry="3.4" fill="${SUN.ink}" stroke="none"/>
      <path d="M28 25q4 3.5 8 0" fill="none" stroke-width="2.4" stroke-linecap="round"/>
      <circle cx="21" cy="24" r="2.6" fill="${SUN.blush}" opacity="0.45" stroke="none"/>
      <circle cx="43" cy="24" r="2.6" fill="${SUN.blush}" opacity="0.45" stroke="none"/>
    </g>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-2 0 124 50">${couch(SUN.me, 0)}${couch(SUN.partner, 54)}</svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
})();

/** A row of five cartoon stars, `rating` of them filled. */
function stars(rating: number, size: number) {
  const star = (i: number) =>
    `<path transform="translate(${i * 26} 0)" d="m12 3.5 2.6 5.5 6 .7-4.5 4.1 1.2 5.9L12 16.8l-5.3 2.9 1.2-5.9-4.5-4.1 6-.7z" fill="${i < rating ? SUN.pop : "none"}" stroke="${SUN.ink}" stroke-opacity="${i < rating ? 1 : 0.4}" stroke-width="2" stroke-linejoin="round"/>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 24">${[0, 1, 2, 3, 4].map(star).join("")}</svg>`;
  return <img alt="" width={size * 5.3} height={size} src={`data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`} />;
}

/** Whose stars: a dot in that person's colour, as on the app's name tags. */
function who(color: string) {
  return <div style={{ width: 22, height: 22, borderRadius: 999, backgroundColor: color, border: `4px solid ${SUN.ink}` }} />;
}

const outlined = (shadow = 8) => ({
  border: `5px solid ${SUN.ink}`,
  boxShadow: `${shadow}px ${shadow}px 0 ${SUN.ink}`,
});

export async function GET(_request: Request, { params }: RouteContext<"/stats/recap/[year]">) {
  const { year: yearParam } = await params;
  const year = Number(yearParam);
  const [profile, partner] = await Promise.all([getCurrentProfile(), getPartner()]);
  if (!profile?.couple_id || !isCountry(profile.country)) return new Response("Not found", { status: 404 });
  if (!Number.isInteger(year) || year < 2000 || year > 2100) return new Response("Not found", { status: 404 });

  const t = getMessages(profile.language);
  const upper = (text: string) => text.toLocaleUpperCase(profile.language);
  const locale = tmdbLocale(profile.language, profile.home_country ?? profile.country);
  const locales = partner?.country ? [locale, tmdbLocale(partner.language, partner.home_country)] : [locale];
  const zones = { [profile.id]: profile.time_zone, ...(partner ? { [partner.id]: partner.time_zone } : {}) };
  const now = new Date();
  const [entries, nights, movieGenres, tvGenres, fontData, rewatches] = await Promise.all([
    getList(profile.couple_id, locales),
    getNightsAt(profile.couple_id, zones, profile.time_zone),
    getGenres("movie", locale).catch(() => []),
    getGenres("tv", locale).catch(() => []),
    font,
    getRewatches(profile.couple_id),
  ]);
  const genreNames = new Map([...movieGenres, ...tvGenres].map((g) => [g.id, g.name]));

  const stats = computeStats(
    entries,
    nights.map((n) => n.starts_at),
    { period: year, meId: profile.id, partnerId: partner?.id ?? null, timeZone: profile.time_zone, now, rewatches },
  );
  const watchedThisYear = entries.filter((e) => e.status === "watched" && e.watched_on?.startsWith(`${year}-`));
  const taste = tasteMatch(watchedThisYear, profile.id, partner?.id ?? null);
  const yearNights = nights.filter((n) => localDate(n.zone, new Date(n.starts_at)).startsWith(`${year}-`));
  const best = streaks(yearNights, now, profile.time_zone).best;
  const favourite = stats.favourites[0] ?? null;
  const topGenre = stats.genres[0] ? genreNames.get(stats.genres[0].id) : null;
  const number = (n: number) => new Intl.NumberFormat(profile.language).format(n);
  const names = [profile.display_name || t.common.you, partner ? partner.display_name || t.common.yourPartner : null]
    .filter(Boolean)
    .join(" & ");
  const nothing = stats.films + stats.series === 0;

  const tiles: [string, number][] = [
    [t.stats.tiles.films, stats.films],
    [t.stats.tiles.series, stats.series],
    [t.stats.tiles.hours, Math.round(stats.minutes / 60)],
    [t.stats.tiles.nights, stats.nights],
  ];
  const facts: [string, string][] = [
    ...(topGenre ? [[t.stats.recap.topGenre, topGenre] as [string, string]] : []),
    ...(taste.percent !== null
      ? [[t.stats.recap.taste, new Intl.NumberFormat(profile.language, { style: "percent" }).format(taste.percent / 100)] as [string, string]]
      : []),
    ...(best > 0 ? [[t.stats.recap.streak, t.stats.recap.weeks(best)] as [string, string]] : []),
  ];

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          backgroundColor: SUN.ground,
          color: SUN.ink,
          fontFamily: "Luckiest Guy",
          padding: "56px 64px",
          position: "relative",
        }}
      >
        <img alt="" src={RAYS} width={WIDTH} height={HEIGHT} style={{ position: "absolute", top: 0, left: 0 }} />
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <img alt="" src={COUCHES} width={150} height={60} />
          <span style={{ fontSize: 34, letterSpacing: 1 }}>{upper(t.common.appName)}</span>
        </div>
        <div
          style={{
            marginTop: 26,
            fontSize: 150,
            lineHeight: 1,
            color: SUN.paper,
            WebkitTextStroke: `6px ${SUN.ink}`,
            textShadow: `8px 8px 0 ${SUN.ink}`,
            transform: "rotate(-2deg)",
          }}
        >
          {upper(t.stats.recap.heading(year))}
        </div>
        <div
          style={{
            marginTop: 22,
            display: "flex",
            backgroundColor: SUN.paper,
            borderRadius: 999,
            padding: "10px 28px 4px",
            fontSize: 36,
            ...outlined(5),
          }}
        >
          {upper(names)}
        </div>

        {/* The four numbers, each on its own tilted paper tile. */}
        <div style={{ marginTop: 40, display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 28, width: 920 }}>
          {tiles.map(([label, value], i) => (
            <div
              key={label}
              style={{
                width: 430,
                height: 170,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: SUN.paper,
                borderRadius: 26,
                transform: `rotate(${i % 2 ? 1.5 : -1.5}deg)`,
                ...outlined(),
              }}
            >
              <span style={{ fontSize: 30, color: SUN.muted }}>{upper(label)}</span>
              <span style={{ fontSize: 104, lineHeight: 1, marginTop: 6 }}>{number(value)}</span>
            </div>
          ))}
        </div>

        {nothing ? (
          <div style={{ marginTop: 56, fontSize: 40, textAlign: "center", width: 860, display: "flex", justifyContent: "center" }}>
            {upper(t.stats.recap.nothing)}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            {facts.length > 0 && (
              <div style={{ marginTop: 40, display: "flex", gap: 20, justifyContent: "center", flexWrap: "wrap", width: 960 }}>
                {facts.map(([label, value]) => (
                  <div
                    key={label}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      backgroundColor: SUN.accent,
                      color: SUN.paper,
                      borderRadius: 22,
                      padding: "16px 26px 10px",
                      ...outlined(6),
                    }}
                  >
                    <span style={{ fontSize: 24, opacity: 0.9 }}>{upper(label)}</span>
                    <span style={{ fontSize: 46, color: SUN.pop, marginTop: 4 }}>{upper(value)}</span>
                  </div>
                ))}
              </div>
            )}
            {favourite && (
              <div
                style={{
                  marginTop: 40,
                  display: "flex",
                  alignItems: "center",
                  gap: 28,
                  backgroundColor: SUN.paper,
                  borderRadius: 26,
                  padding: 20,
                  width: 860,
                  transform: "rotate(-1deg)",
                  ...outlined(),
                }}
              >
                {favourite.poster_path && (
                  <img
                    alt=""
                    src={tmdbImage(favourite.poster_path, "w342")}
                    width={120}
                    height={180}
                    style={{ borderRadius: 12, border: `4px solid ${SUN.ink}` }}
                  />
                )}
                <div style={{ display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>
                  <span style={{ fontSize: 26, color: SUN.muted }}>{upper(t.stats.recap.favourite)}</span>
                  <span style={{ fontSize: 44, lineHeight: 1.05 }}>{upper(favourite.title)}</span>
                  {partner && (
                    <div style={{ display: "flex", gap: 30, alignItems: "center" }}>
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>{who(SUN.me)}{stars(favourite.ratings[profile.id], 30)}</div>
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>{who(SUN.partner)}{stars(favourite.ratings[partner.id], 30)}</div>
                    </div>
                  )}
                </div>
              </div>
            )}
            {/* A quieter year: the couches fill the space the favourite would. */}
            {!favourite && <img alt="" src={COUCHES} width={360} height={146} style={{ marginTop: 70 }} />}
          </div>
        )}

        <div style={{ marginTop: "auto", display: "flex", fontSize: 30, color: SUN.ink }}>{upper(t.stats.recap.tagline)}</div>
      </div>
    ),
    {
      width: WIDTH,
      height: HEIGHT,
      fonts: [{ name: "Luckiest Guy", data: fontData, weight: 400, style: "normal" }],
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Disposition": `inline; filename="${t.stats.recap.fileName(year)}"`,
      },
    },
  );
}
