import type { ListStatus } from "../list-rules";
import type { Verdict } from "../watch";

/** Text shared across pages: navigation, footer, shared components, kinds of title. */
const en = {
  appName: "Two Couches",
  nav: {
    list: "Our list",
    browse: "Browse",
    comingSoon: "Coming soon",
    /** Screen-reader text for the dot on Coming soon. */
    newAlerts: (count: number) => (count === 1 ? "1 new alert" : `${count} new alerts`),
    search: "Search",
    settings: "Settings",
    signOut: "Sign out",
  },
  footer:
    "Film and TV data from TMDB. This product uses the TMDB API but is not endorsed or certified by TMDB. Streaming availability from JustWatch.",
  mediaType: { movie: "Film", tv: "Series" } satisfies Record<"movie" | "tv", string>,
  mediaTypePlural: { movie: "Films", tv: "Series" } satisfies Record<"movie" | "tv", string>,
  statuses: {
    want: "Want to watch",
    watching: "Watching",
    watched: "Watched",
    dropped: "Dropped",
  } satisfies Record<ListStatus, string>,
  /** Last episode watched, e.g. "S2 E5". */
  progress: (season: number, episode: number) => `S${season} E${episode}`,
  yourPartner: "Your partner",
  you: "You",
  watchBadge: {
    both: "You can both watch",
    me: "On your services",
    meOnly: "Only you",
    partner: (name: string) => `Only ${name}`,
    free: "Free to watch",
  } satisfies Record<Exclude<Verdict, "none"> | "meOnly", unknown>,
  stars: (who: string, rating: number) => `${who}: ${rating} out of 5 stars`,
  add: { add: "+ Add", adding: "Adding…", onList: "✓ On our list" },
  searchBox: { placeholder: "Search films and series", button: "Search" },
  poster: (title: string) => `Poster for ${title}`,
  notFound: {
    heading: "Nothing here",
    body: "That page or title doesn't exist. Try searching for it instead.",
  },
};

const tr: typeof en = {
  appName: "Two Couches",
  nav: {
    list: "Listemiz",
    browse: "Keşfet",
    comingSoon: "Yakında",
    newAlerts: (count: number) => `${count} yeni bildirim`,
    search: "Ara",
    settings: "Ayarlar",
    signOut: "Çıkış yap",
  },
  footer:
    "Film ve dizi verileri TMDB'den alınır. Bu ürün TMDB API'sini kullanır, ancak TMDB tarafından onaylanmamış veya sertifikalandırılmamıştır. Yayın bilgileri JustWatch'tan alınır.",
  mediaType: { movie: "Film", tv: "Dizi" },
  mediaTypePlural: { movie: "Filmler", tv: "Diziler" },
  statuses: {
    want: "İzlenecek",
    watching: "İzleniyor",
    watched: "İzlendi",
    dropped: "Bırakıldı",
  },
  progress: (season: number, episode: number) => `${season}. sezon ${episode}. bölüm`,
  yourPartner: "Partnerin",
  you: "Sen",
  watchBadge: {
    both: "İkiniz de izleyebilirsiniz",
    me: "Senin platformlarında",
    meOnly: "Sadece sen",
    partner: (name: string) => `Sadece ${name}`,
    free: "Ücretsiz izlenebilir",
  },
  stars: (who: string, rating: number) => `${who}: 5 üzerinden ${rating} yıldız`,
  add: { add: "+ Ekle", adding: "Ekleniyor…", onList: "✓ Listemizde" },
  searchBox: { placeholder: "Film ve dizi ara", button: "Ara" },
  poster: (title: string) => `${title} afişi`,
  notFound: {
    heading: "Burada bir şey yok",
    body: "Bu sayfa ya da yapım bulunamadı. Aramayı dene.",
  },
};

const messages = { en, tr };
export default messages;
