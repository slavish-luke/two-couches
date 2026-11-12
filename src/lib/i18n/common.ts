import type { ListStatus } from "../list-rules";
import type { Verdict } from "../watch";

/** Text shared across pages: navigation, footer, shared components, kinds of title. */
const en = {
  appName: "Two Couches",
  nav: {
    list: "Our list",
    browse: "Browse",
    comingSoon: "Coming soon",
    watchNights: "Watch nights",
    /** Screen-reader text for the dot on Coming soon. */
    newAlerts: (count: number) => (count === 1 ? "1 new alert" : `${count} new alerts`),
    stats: "Stats",
    search: "Search",
    settings: "Settings",
    /** Labels under the icons in the phone tab bar. */
    short: { list: "List", browse: "Browse", comingSoon: "Soon", watchNights: "Nights", stats: "Stats" },
    label: "Main",
  },
  /** Page <title>s, before " · Two Couches". */
  pageTitles: {
    browse: "Browse",
    comingSoon: "Coming soon",
    couple: "Your couple",
    signIn: "Sign in",
    search: "Search",
    settings: "Settings",
    title: "Where to watch",
    planNight: "Plan a watch night",
    changeNight: "Change the watch night",
    watchNights: "Watch nights",
    stats: "Stats",
    offline: "Offline",
    pick: "Pick for tonight",
    swipe: "Swipe together",
    watchRoom: "Watch room",
    share: "Add to our list",
  },
  offlineShort: "Offline",
  offline: "You're offline. Anything you change will be saved when you're back.",
  offlinePage: {
    heading: "You're offline",
    body: "This page needs a connection. Your list is saved on this device, so you can still look through it.",
    openList: "Open our list",
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
    someday: "Someday",
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
    /** "Free to watch" on Home's list cards, where the poster is small. */
    freeShort: "Free",
    /** The words on the starburst for what you can both watch, and on the small one on poster cards. */
    stamp: "Both of us!",
    stampShort: "Both!",
    /** The services that make it "both": one name when it's the same service, else yours then theirs. */
    proof: (services: string[]) => `On ${services.join(" and ")}`,
  } satisfies Record<Exclude<Verdict, "none"> | "meOnly" | "freeShort" | "stamp" | "stampShort" | "proof", unknown>,
  stars: (who: string, rating: number) => `${who}: ${rating} out of 5 stars`,
  add: { add: "Add", adding: "Adding…", onList: "On our list" },
  dismiss: {
    notInterested: "Not interested",
    dismissed: "Not interested",
    saving: "Saving…",
    undo: "Tap to see it in suggestions again",
    failed: "Couldn't save that. Try again.",
  },
  searchBox: { placeholder: "Search films and series", button: "Search" },
  poster: (title: string) => `Poster for ${title}`,
  notFound: {
    heading: "Nothing here",
    body: "That page or title doesn't exist. Try searching for it instead.",
    home: "Back to our list",
  },
};

const tr: typeof en = {
  appName: "Two Couches",
  nav: {
    list: "Listemiz",
    browse: "Keşfet",
    comingSoon: "Yakında",
    watchNights: "İzleme geceleri",
    newAlerts: (count: number) => `${count} yeni bildirim`,
    stats: "İstatistikler",
    search: "Ara",
    settings: "Ayarlar",
    short: { list: "Liste", browse: "Keşfet", comingSoon: "Yakında", watchNights: "Geceler", stats: "İstatistik" },
    label: "Ana menü",
  },
  pageTitles: {
    browse: "Keşfet",
    comingSoon: "Yakında",
    couple: "Çiftiniz",
    signIn: "Giriş yap",
    search: "Ara",
    settings: "Ayarlar",
    title: "Nerede izlenir",
    planNight: "İzleme gecesi planla",
    changeNight: "İzleme gecesini değiştir",
    watchNights: "İzleme geceleri",
    stats: "İstatistikler",
    offline: "Çevrimdışı",
    pick: "Bu akşam ne izlesek?",
    swipe: "Birlikte kaydırın",
    watchRoom: "İzleme odası",
    share: "Listemize ekle",
  },
  offlineShort: "Çevrimdışı",
  offline: "Çevrimdışısın. Yaptığın değişiklikler bağlantı gelince kaydedilecek.",
  offlinePage: {
    heading: "Çevrimdışısın",
    body: "Bu sayfa için bağlantı gerekiyor. Listen bu cihazda kayıtlı, yine de göz atabilirsin.",
    openList: "Listemizi aç",
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
    someday: "Bir gün",
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
    freeShort: "Ücretsiz",
    stamp: "İkimiz de!",
    stampShort: "İkimiz!",
    proof: (services: string[]) => `Platform: ${services.join(" ve ")}`,
  },
  stars: (who: string, rating: number) => `${who}: 5 üzerinden ${rating} yıldız`,
  add: { add: "Ekle", adding: "Ekleniyor…", onList: "Listemizde" },
  dismiss: {
    notInterested: "İlgilenmiyoruz",
    dismissed: "İlgilenmiyoruz",
    saving: "Kaydediliyor…",
    undo: "Önerilerde yeniden görmek için dokun",
    failed: "Kaydedilemedi. Tekrar dene.",
  },
  searchBox: { placeholder: "Film ve dizi ara", button: "Ara" },
  poster: (title: string) => `${title} afişi`,
  notFound: {
    heading: "Burada bir şey yok",
    body: "Bu sayfa ya da yapım bulunamadı. Aramayı dene.",
    home: "Listemize dön",
  },
};

const messages = { en, tr };
export default messages;
