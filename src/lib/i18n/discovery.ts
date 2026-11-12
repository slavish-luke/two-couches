/**
 * Sprint 19: "gone from your service" badges, "Can't wait" on Coming soon, content guidance on the title
 * page, Settings' "Warn me about" and the release and episode events in the calendar feed.
 */
const en = {
  gone: {
    /** A list card's or provider column's tag, e.g. "Left Netflix". */
    tag: (services: string) => `Left ${services}`,
    /** The tag read out with who lost it ("you" or a name). */
    label: (services: string, who: string) => `Left ${services}, for ${who}`,
    you: "you",
    /** The title page's line under a country's services. */
    heading: "No longer here",
    note: "It left a service you pay for. We'll tell you if it comes back.",
    noteTheirs: (name: string) => `It left a service ${name} pays for.`,
  },
  cantWait: {
    button: "Can't wait",
    /** The toggle's accessible label adds who's already marked it. */
    marked: (names: string) => `Can't wait: ${names}`,
    nobody: "Nobody has marked it yet",
    you: "you",
    both: "You both can't wait! We'll remind you when it's streaming.",
    failed: "Couldn't save that. Try again.",
  },
  guidance: {
    heading: "Before you watch",
    ages: "Age ratings",
    /** A country without a certification on TMDB. */
    noRating: "No rating yet",
    headsUp: (topics: string) => `Heads up: ${topics}`,
    headsUpNote: "From your “Warn me about” list in Settings.",
    partnerWarn: (name: string, topics: string) => `${name} asked to be warned about: ${topics}`,
    dtdd: "Content warnings on DoesTheDogDie",
    dtddNote: "Opens a search for this title on DoesTheDogDie.com.",
    nothing: "Neither of you asked to be warned about anything this title is tagged with.",
    setUp: "Choose topics to be warned about in Settings",
  },
  warn: {
    heading: "Warn me about",
    intro:
      "Topics you'd rather know about before pressing play. When a title is tagged with one, its page says so, for you and for your partner. Topics come from TMDB, in English.",
    search: "Find a topic",
    placeholder: "e.g. spider",
    searching: "Searching…",
    noResults: "No topics match that.",
    add: (name: string) => `Add ${name}`,
    remove: (name: string) => `Remove ${name}`,
    empty: "Nothing yet.",
    yours: "Your topics",
    partners: (name: string) => `${name}'s topics`,
    limit: "That's 30 topics, the most you can keep. Remove one to add another.",
    failed: "Couldn't save that. Try again.",
    searchFailed: "Couldn't search TMDB. Try again in a minute.",
  },
  feed: {
    cinema: (title: string, countries: string) => `${title}: in cinemas (${countries})`,
    digital: (title: string, countries: string) => `${title}: out digitally (${countries})`,
    episode: (title: string, episode: string) => `${title}: ${episode}`,
    releaseNote: "On our list. Release dates come from TMDB and can change.",
    episodeNote: "The next episode, on our list. Air dates come from TMDB and can change.",
  },
};

const tr: typeof en = {
  gone: {
    tag: (services: string) => `Kalktı: ${services}`,
    label: (services: string, who: string) => `Kalktı: ${services} (${who})`,
    you: "sen",
    heading: "Artık burada değil",
    note: "Ödediğin bir platformdan kalktı. Geri gelirse haber vereceğiz.",
    noteTheirs: (name: string) => `Ödediği bir platformdan kalktı: ${name}`,
  },
  cantWait: {
    button: "Sabırsızım",
    marked: (names: string) => `Sabırsızlananlar: ${names}`,
    nobody: "Henüz kimse işaretlemedi",
    you: "sen",
    both: "İkiniz de sabırsızlanıyorsunuz! Yayına girince hatırlatacağız.",
    failed: "Kaydedilemedi. Tekrar dene.",
  },
  guidance: {
    heading: "İzlemeden önce",
    ages: "Yaş sınırları",
    noRating: "Henüz sınıflandırma yok",
    headsUp: (topics: string) => `Dikkat: ${topics}`,
    headsUpNote: "Ayarlar’daki “Beni uyar” listenden.",
    partnerWarn: (name: string, topics: string) => `${name} şunlar için uyarılmak istedi: ${topics}`,
    dtdd: "DoesTheDogDie içerik uyarıları",
    dtddNote: "DoesTheDogDie.com sitesinde bu yapımı arar.",
    nothing: "Bu yapımın etiketlerinde ikinizin de uyarılmak istediği bir konu yok.",
    setUp: "Uyarılmak istediğin konuları Ayarlar’dan seç",
  },
  warn: {
    heading: "Beni uyar",
    intro:
      "İzlemeye başlamadan önce bilmek istediğin konular. Bir yapım bunlardan biriyle etiketliyse sayfası hem sana hem partnerine söyler. Konular TMDB’den gelir ve İngilizcedir.",
    search: "Konu bul",
    placeholder: "ör. spider",
    searching: "Aranıyor…",
    noResults: "Eşleşen konu yok.",
    add: (name: string) => `Ekle: ${name}`,
    remove: (name: string) => `Kaldır: ${name}`,
    empty: "Henüz bir şey yok.",
    yours: "Senin konuların",
    partners: (name: string) => `Konuları: ${name}`,
    limit: "En fazla 30 konu tutabilirsin. Yenisini eklemek için birini kaldır.",
    failed: "Kaydedilemedi. Tekrar dene.",
    searchFailed: "TMDB’de aranamadı. Bir dakika sonra tekrar dene.",
  },
  feed: {
    cinema: (title: string, countries: string) => `${title}: sinemalarda (${countries})`,
    digital: (title: string, countries: string) => `${title}: dijitalde (${countries})`,
    episode: (title: string, episode: string) => `${title}: ${episode}`,
    releaseNote: "Listemizde. Çıkış tarihleri TMDB’den gelir ve değişebilir.",
    episodeNote: "Listemizdeki dizinin sıradaki bölümü. Yayın tarihleri TMDB’den gelir ve değişebilir.",
  },
};

const messages = { en, tr };
export default messages;
