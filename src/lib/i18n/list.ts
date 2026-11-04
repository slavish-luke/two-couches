/** Home page (the shared list) and the search page. */
const en = {
  people: {
    label: "Both clocks",
    noName: "No name yet",
    localTime: (time: string) => `${time} local time`,
    /** Between the two clocks on the home page. */
    apart: (hours: number) => (hours === 0 ? "Same time" : `${hours} h apart`),
    settingUp: "Still setting up",
    waiting: "Waiting for your partner",
    shareInvite: "Share your invite code",
  },
  viewsLabel: "List views",
  views: { next: "Up next", watched: "Watched", dropped: "Dropped" },
  bothFilter: "We can both watch",
  empty: {
    heading: "Nothing here yet",
    body: "Search for a film or series and add it to your list.",
    noMatches: "Nothing matches these filters",
    clearFilters: "Clear filters",
    next: "Everything's watched or dropped. Search for something new.",
    watched: "Nothing watched yet. Mark a title watched from its page.",
    dropped: "Nothing dropped.",
  },
  /** Follows "Watching · ", e.g. "up to S2 E5". */
  upTo: (progress: string) => `up to ${progress}`,
  addedByYou: (date: string) => `Added by you on ${date}`,
  addedBy: (name: string, date: string) => `Added by ${name} on ${date}`,
  addedOn: (date: string) => `Added on ${date}`,
  notRated: "Not rated",
  search: {
    heading: "Search",
    failed: "Search isn't working right now. Try again in a minute.",
    noResults: (query: string) => `No films or series match “${query}”.`,
    /** Before anything has been searched for. */
    prompt: "Find a film or series and see where each of you can stream it.",
    noResultsHint: "Check the spelling, or try the original title.",
  },
};

const tr: typeof en = {
  people: {
    label: "İki saat",
    noName: "Henüz isim yok",
    localTime: (time: string) => `Yerel saat ${time}`,
    apart: (hours: number) => (hours === 0 ? "Aynı saat" : `${hours} saat fark`),
    settingUp: "Kurulum sürüyor",
    waiting: "Partnerin bekleniyor",
    shareInvite: "Davet kodunu paylaş",
  },
  viewsLabel: "Liste görünümleri",
  views: { next: "Sıradakiler", watched: "İzlenenler", dropped: "Bırakılanlar" },
  bothFilter: "İkimiz de izleyebiliriz",
  empty: {
    heading: "Henüz bir şey yok",
    body: "Bir film ya da dizi ara, listemize ekle.",
    noMatches: "Bu filtrelere uyan bir şey yok",
    clearFilters: "Filtreleri temizle",
    next: "Hepsi izlendi ya da bırakıldı. Yeni bir şey ara.",
    watched: "Henüz izlenen bir şey yok. Bir yapımı kendi sayfasından izlendi olarak işaretle.",
    dropped: "Bırakılan bir şey yok.",
  },
  upTo: (progress: string) => `en son ${progress}`,
  addedByYou: (date: string) => `${date} tarihinde sen ekledin`,
  addedBy: (name: string, date: string) => `Ekleyen: ${name} · ${date}`,
  addedOn: (date: string) => `${date} tarihinde eklendi`,
  notRated: "Puanlanmadı",
  search: {
    heading: "Arama",
    failed: "Arama şu an çalışmıyor. Bir dakika sonra tekrar dene.",
    noResults: (query: string) => `“${query}” ile eşleşen film ya da dizi yok.`,
    prompt: "Bir film ya da dizi bul, ikinizin de nerede izleyebileceğini gör.",
    noResultsHint: "Yazımı kontrol et ya da orijinal adını dene.",
  },
};

const messages = { en, tr };
export default messages;
