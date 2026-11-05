import type { ProviderKind } from "../watch";

/** Title page, its "On our list" panel and the list actions' error messages. */
const en = {
  seasons: (n: number) => `${n} season${n === 1 ? "" : "s"}`,
  /** "1 h 30 min" */
  runtime: (minutes: number) => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return h ? `${h} h${m ? ` ${m} min` : ""}` : `${m} min`;
  },
  /** A series' typical episode length, from runtime(). */
  episodeRuntime: (runtime: string) => `${runtime} episodes`,
  trailer: "Watch the trailer",
  /** The title page's poster deck, which is one button: tapping it brings the next poster to the top. */
  shufflePosters: (shown: number, total: number) => `Shuffle posters (showing ${shown} of ${total})`,
  whereToWatch: "Where to watch",
  banner: {
    both: {
      heading: "You can both watch this",
      detail: (mine: string, partner: string, theirs: string) => `You on ${mine}, ${partner} on ${theirs}.`,
    },
    me: {
      heading: "Only you can stream this",
      headingAlone: "You can stream this",
      detail: (mine: string, partner: string, theirCountry: string) =>
        `You have it on ${mine}. None of ${partner}'s services carry it in ${theirCountry}.`,
      detailAlone: (mine: string) => `On ${mine}.`,
    },
    partner: {
      heading: (partner: string) => `Only ${partner} can stream this`,
      detail: (partner: string, theirs: string, myCountry: string) =>
        `${partner} has it on ${theirs}. None of your services carry it in ${myCountry}.`,
    },
    free: {
      detail: "Neither of you pays for a service with it, but it's free in both countries.",
      detailAlone: "It's free to stream.",
    },
    none: {
      heading: "Neither of you can stream this yet",
      headingAlone: "Not on your services",
      detail: "It isn't on a service you pay for. Renting or buying it may still be an option below.",
    },
  },
  kinds: {
    flatrate: "Subscription",
    free: "Free",
    ads: "Free with ads",
    rent: "Rent",
    buy: "Buy",
  } satisfies Record<ProviderKind, string>,
  couldntCheck: (country: string) => `Couldn't check ${country} right now. Try again shortly.`,
  notAvailable: (country: string) => `Not available to stream, rent or buy in ${country}.`,
  youPay: (provider: string) => `You pay for ${provider}`,
  theyPay: (who: string, provider: string) => `${who} pays for ${provider}`,
  youPayLabel: "you pay for this",
  theyPayLabel: "they pay for this",
  checked: (when: string) => `Checked ${when}`,
  justWatch: "Data from JustWatch via TMDB",
  panel: {
    saveForLater: "Save it for later",
    notePlaceholder: "Add a note (optional)",
    note: "Note",
    addToList: "Add to our list",
    onOurList: "On our list",
    addedByYou: (date: string) => `Added by you on ${date}`,
    addedBy: (name: string, date: string) => `Added by ${name} on ${date}`,
    addedOn: (date: string) => `Added on ${date}`,
    status: "Status",
    watchedOn: "Watched on",
    ratings: "Ratings",
    notRated: "not rated yet",
    yourRating: "Your rating",
    starCount: (n: number) => `${n} star${n === 1 ? "" : "s"}`,
    clearRating: "Click again to clear",
    season: "Season",
    episode: "Episode",
    save: "Save",
    cancel: "Cancel",
    edit: "Edit",
    progress: "Progress: ",
    /** After "Progress: ", e.g. "watched up to S2 E5" with common.progress(). */
    watchedUpTo: (progress: string) => `watched up to ${progress}`,
    notStarted: "not started",
    watchedEpisode: (episode: number) => `Watched E${episode}`,
    /** First episode of a season. */
    watchedSeasonStart: (season: number) => `Watched S${season} E1`,
    categories: "Categories",
    newCategory: "New category",
    addCategory: "Add",
    notesPlaceholder: "Who recommended it, which episode to start from…",
    saveNote: "Save note",
    remove: "Remove from our list",
    removeConfirm: "Remove it, with its note and ratings?",
    removeYes: "Remove",
    removeNo: "Keep it",
  },
  /** Messages from the list's Server Actions. */
  errors: {
    notATitle: "That isn't a film or series.",
    noteTooLong: (max: number) => `Keep the note under ${max} characters.`,
    unknownTitle: "TMDB doesn't know that title.",
    tmdbDown: "Couldn't reach TMDB. Try again.",
    addFailed: "Couldn't add it. Try again.",
    noSuchItem: "That list item doesn't exist.",
    pickStatus: "Pick a status.",
    badCategories: (max: number, length: number) => `Use up to ${max} categories of up to ${length} characters each.`,
    enterProgress: "Enter a season and episode.",
    enterDate: "Enter a date.",
    saveFailed: "Couldn't save. Try again.",
    gone: "It's no longer on your list.",
    removeFailed: "Couldn't remove it. Try again.",
    ratingRange: "Ratings are 1 to 5 stars.",
    rateFailed: "Couldn't save your rating. Try again.",
  },
};

// Names and country names are never given a suffix ("Ayşe'nin"), since its form depends on the word.
const tr: typeof en = {
  seasons: (n: number) => `${n} sezon`,
  runtime: (minutes: number) => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return h ? `${h} sa${m ? ` ${m} dk` : ""}` : `${m} dk`;
  },
  episodeRuntime: (runtime: string) => `Bölüm başı ${runtime}`,
  trailer: "Fragmanı izle",
  shufflePosters: (shown: number, total: number) => `Afişleri karıştır (${total} afişten ${shown}.)`,
  whereToWatch: "Nerede izlenir",
  banner: {
    both: {
      heading: "Bunu ikiniz de izleyebilirsiniz",
      detail: (mine: string, partner: string, theirs: string) => `Sen: ${mine}. ${partner}: ${theirs}.`,
    },
    me: {
      heading: "Bunu sadece sen izleyebilirsin",
      headingAlone: "Bunu izleyebilirsin",
      detail: (mine: string, partner: string, theirCountry: string) =>
        `Senin platformlarında var: ${mine}. ${partner} ise ${theirCountry} bölgesindeki platformlarının hiçbirinde bulamıyor.`,
      detailAlone: (mine: string) => `Şurada var: ${mine}.`,
    },
    partner: {
      heading: (partner: string) => `Bunu sadece ${partner} izleyebilir`,
      detail: (partner: string, theirs: string, myCountry: string) =>
        `${partner} şurada izleyebilir: ${theirs}. Senin ${myCountry} bölgesindeki platformlarının hiçbirinde yok.`,
    },
    free: {
      detail: "Abone olduğunuz platformlarda yok, ama iki ülkede de ücretsiz izlenebiliyor.",
      detailAlone: "Ücretsiz izlenebiliyor.",
    },
    none: {
      heading: "Henüz ikiniz de izleyemiyorsunuz",
      headingAlone: "Senin platformlarında yok",
      detail: "Abone olduğunuz platformların hiçbirinde yok. Aşağıda kiralama ya da satın alma seçeneği olabilir.",
    },
  },
  kinds: {
    flatrate: "Abonelik",
    free: "Ücretsiz",
    ads: "Reklamlı ücretsiz",
    rent: "Kiralık",
    buy: "Satın al",
  },
  couldntCheck: (country: string) => `${country} bölgesi şu anda kontrol edilemedi. Biraz sonra tekrar dene.`,
  notAvailable: (country: string) => `${country} bölgesinde izlenemiyor, kiralanamıyor ya da satın alınamıyor.`,
  youPay: (provider: string) => `${provider} aboneliğin var`,
  theyPay: (who: string, provider: string) => `${who}: ${provider} aboneliği var`,
  youPayLabel: "aboneliğin var",
  theyPayLabel: "aboneliği var",
  checked: (when: string) => `Son kontrol: ${when}`,
  justWatch: "Veriler JustWatch'tan, TMDB aracılığıyla",
  panel: {
    saveForLater: "Sonraya sakla",
    notePlaceholder: "Not ekle (isteğe bağlı)",
    note: "Not",
    addToList: "Listemize ekle",
    onOurList: "Listemizde",
    addedByYou: (date: string) => `${date} tarihinde sen ekledin`,
    addedBy: (name: string, date: string) => `${date} tarihinde ${name} ekledi`,
    addedOn: (date: string) => `${date} tarihinde eklendi`,
    status: "Durum",
    watchedOn: "İzlenme tarihi",
    ratings: "Puanlar",
    notRated: "henüz puanlamadı",
    yourRating: "Puanın",
    starCount: (n: number) => `${n} yıldız`,
    clearRating: "Kaldırmak için tekrar tıkla",
    season: "Sezon",
    episode: "Bölüm",
    save: "Kaydet",
    cancel: "Vazgeç",
    edit: "Düzenle",
    progress: "İlerleme: ",
    watchedUpTo: (progress: string) => `son izlenen ${progress}`,
    notStarted: "başlanmadı",
    watchedEpisode: (episode: number) => `${episode}. bölüm izlendi`,
    watchedSeasonStart: (season: number) => `${season}. sezon 1. bölüm izlendi`,
    categories: "Kategoriler",
    newCategory: "Yeni kategori",
    addCategory: "Ekle",
    notesPlaceholder: "Kim önerdi, hangi bölümden başlanmalı…",
    saveNote: "Notu kaydet",
    remove: "Listemizden çıkar",
    removeConfirm: "Notu ve puanlarıyla birlikte çıkarılsın mı?",
    removeYes: "Çıkar",
    removeNo: "Kalsın",
  },
  errors: {
    notATitle: "Bu bir film ya da dizi değil.",
    noteTooLong: (max: number) => `Not en fazla ${max} karakter olabilir.`,
    unknownTitle: "TMDB bu yapımı tanımıyor.",
    tmdbDown: "TMDB'ye ulaşılamadı. Tekrar dene.",
    addFailed: "Eklenemedi. Tekrar dene.",
    noSuchItem: "Bu liste öğesi bulunamadı.",
    pickStatus: "Bir durum seç.",
    badCategories: (max: number, length: number) =>
      `En fazla ${max} kategori kullan, her biri en fazla ${length} karakter olsun.`,
    enterProgress: "Sezon ve bölüm gir.",
    enterDate: "Bir tarih gir.",
    saveFailed: "Kaydedilemedi. Tekrar dene.",
    gone: "Artık listemizde değil.",
    removeFailed: "Çıkarılamadı. Tekrar dene.",
    ratingRange: "Puan 1 ile 5 yıldız arasında olmalı.",
    rateFailed: "Puanın kaydedilemedi. Tekrar dene.",
  },
};

const messages = { en, tr };
export default messages;
