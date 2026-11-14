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
    watched: "Nothing watched yet. Tap Watched on a title in Up next, or mark it on its page.",
    dropped: "Nothing dropped.",
  },
  /** Follows "Watching · ", e.g. "up to S2 E5". */
  upTo: (progress: string) => `up to ${progress}`,
  addedByYou: (date: string) => `You · ${date}`,
  addedBy: (name: string, date: string) => `${name} · ${date}`,
  addedOn: (date: string) => `Added ${date}`,
  notRated: "Not rated",
  /** Sprint 26: an Up next card's quick moves, and the rubber stamp they slam on. */
  leave: {
    watched: "Watched",
    watchedLabel: (title: string) => `Mark ${title} watched`,
    drop: "Drop",
    dropLabel: (title: string) => `Drop ${title}`,
  },
  stamp: { watched: "Watched!", dropped: "Dropped" },
  search: {
    heading: "Search",
    failed: "Search isn't working right now. Try again in a minute.",
    noResults: (query: string) => `No films or series match “${query}”.`,
    /** Before anything has been searched for. */
    prompt: "Find a film or series and see where each of you can stream it.",
    noResultsHint: "Check the spelling, or try the original title.",
  },
  /** Home on phones (Sprint 24): the cards that wait for you, folded to chips, and the next night as a strip. */
  tray: {
    label: "Waiting for you",
    wrapups: (n: number) => `How were your last ${n} nights?`,
    sentOne: (name: string, title: string) => `${name} sent you ${title}`,
    sentMany: (name: string, n: number) => `${name} sent you ${n} titles`,
    freeAsk: "Free tonight?",
    /** The next night's strip: "4:00 PM for you · 5:00 AM for Alex". */
    times: (mine: string, theirs: string, name: string) => `${mine} for you · ${theirs} for ${name}`,
    timesAlone: (mine: string) => `${mine} for you`,
    noTitle: "Title to be decided",
    proposals: "Times suggested for a night",
    pickOne: "Pick one",
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
  views: { next: "Sırada", watched: "İzlendi", dropped: "Bırakıldı" },
  bothFilter: "İkimiz de izleyebiliriz",
  empty: {
    heading: "Henüz bir şey yok",
    body: "Bir film ya da dizi ara, listemize ekle.",
    noMatches: "Bu filtrelere uyan bir şey yok",
    clearFilters: "Filtreleri temizle",
    next: "Hepsi izlendi ya da bırakıldı. Yeni bir şey ara.",
    watched: "Henüz izlenen bir şey yok. Sıradakilerden birinde İzledik'e dokun ya da yapımın sayfasından işaretle.",
    dropped: "Bırakılan bir şey yok.",
  },
  upTo: (progress: string) => `en son ${progress}`,
  addedByYou: (date: string) => `Sen · ${date}`,
  addedBy: (name: string, date: string) => `${name} · ${date}`,
  addedOn: (date: string) => `Eklendi: ${date}`,
  notRated: "Puanlanmadı",
  leave: {
    watched: "İzledik",
    watchedLabel: (title: string) => `İzlendi olarak işaretle: ${title}`,
    drop: "Bırak",
    dropLabel: (title: string) => `Bırak: ${title}`,
  },
  stamp: { watched: "İzlendi!", dropped: "Bırakıldı" },
  search: {
    heading: "Arama",
    failed: "Arama şu an çalışmıyor. Bir dakika sonra tekrar dene.",
    noResults: (query: string) => `“${query}” ile eşleşen film ya da dizi yok.`,
    prompt: "Bir film ya da dizi bul, ikinizin de nerede izleyebileceğini gör.",
    noResultsHint: "Yazımı kontrol et ya da orijinal adını dene.",
  },
  tray: {
    label: "Seni bekleyenler",
    wrapups: (n: number) => `Son ${n} izleme gecesi nasıldı?`,
    sentOne: (name: string, title: string) => `${title} · Gönderen: ${name}`,
    sentMany: (name: string, n: number) => `${n} yapım · Gönderen: ${name}`,
    freeAsk: "Bu akşam boş musun?",
    times: (mine: string, theirs: string, name: string) => `Sen: ${mine} · ${name}: ${theirs}`,
    timesAlone: (mine: string) => `Sen: ${mine}`,
    noTitle: "Ne izleneceği belli değil",
    proposals: "Bir gece için önerilen saatler",
    pickOne: "Birini seç",
  },
};

const messages = { en, tr };
export default messages;
