import "server-only";

const TMDB_API = "https://api.themoviedb.org/3";
export const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p";

export function isTmdbConfigured() {
  return Boolean(process.env.TMDB_API_TOKEN);
}

/** GET a TMDB v3 endpoint with the server-side read token. Never import this from client code. */
export async function tmdbGet<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const token = process.env.TMDB_API_TOKEN;
  if (!token) throw new Error("TMDB_API_TOKEN is not set");

  const url = new URL(`${TMDB_API}${path}`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`TMDB ${path} responded ${res.status}`);
  return res.json() as Promise<T>;
}

type WatchProviderList = {
  results: {
    provider_id: number;
    provider_name: string;
    logo_path: string | null;
    display_priority: number;
    display_priorities?: Record<string, number>;
  }[];
};

/** Every streaming service TMDB lists for a country, across movies and TV. */
export async function fetchWatchProviders(country: string) {
  const params = { watch_region: country, language: "en-US" };
  const [movie, tv] = await Promise.all([
    tmdbGet<WatchProviderList>("/watch/providers/movie", params),
    tmdbGet<WatchProviderList>("/watch/providers/tv", params),
  ]);

  const byId = new Map<number, { provider_id: number; name: string; logo_path: string | null; display_priority: number }>();
  for (const p of [...movie.results, ...tv.results]) {
    const priority = p.display_priorities?.[country] ?? p.display_priority;
    const existing = byId.get(p.provider_id);
    if (!existing || priority < existing.display_priority) {
      byId.set(p.provider_id, {
        provider_id: p.provider_id,
        name: p.provider_name,
        logo_path: p.logo_path,
        display_priority: priority,
      });
    }
  }
  return [...byId.values()];
}
