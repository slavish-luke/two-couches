/** After the night: the "How was it?" wrap-up card and hidden reviews. */
const en = {
  wrapup: {
    /** Screen-reader label for the cards on the home page. */
    label: "After your watch nights",
    heading: (title: string) => `How was ${title}?`,
    when: (day: string) => `Your watch night, ${day}`,
    markWatched: "We watched it",
    alreadyWatched: (date: string) => `On your Watched list since ${date}`,
    alreadyWatchedNoDate: "On your Watched list",
    watchedUpTo: "Watched up to",
    partnerMovedOn: (name: string, progress: string) => `${name} has already moved it on to ${progress}.`,
    yourRating: "Your rating",
    optional: "optional",
    notOnList: "Saving puts it on your list.",
    save: "Save",
    saving: "Saving…",
    notNow: "Not now",
  },
  review: {
    heading: "Reviews",
    yours: "Your review",
    placeholder: "A few lines, if you like",
    /** Under your own box, while your partner hasn't written one. */
    hint: (name: string) => `${name} sees it once they've written theirs.`,
    partnerHidden: (name: string) => `${name} has written theirs: write yours to see it.`,
    partnerShown: (name: string) => `${name}'s review`,
    count: (n: number, max: number) => `${n}/${max}`,
    save: "Save review",
    cancel: "Cancel",
    /** Shown when the box is emptied: saving removes the review. */
    willDelete: "Saving an empty review removes it.",
  },
  errors: {
    gone: "That watch night isn't there any more.",
    notOver: "That watch night hasn't finished yet.",
    noSuchItem: "That isn't on your list any more.",
    tooLong: (max: number) => `Keep the review to ${max} characters.`,
    saveFailed: "Couldn't save that. Try again.",
  },
};

const tr: typeof en = {
  wrapup: {
    label: "İzleme gecelerinden sonra",
    heading: (title: string) => `${title} nasıldı?`,
    when: (day: string) => `İzleme geceniz: ${day}`,
    markWatched: "İzledik",
    alreadyWatched: (date: string) => `İzlenenler listenizde (${date})`,
    alreadyWatchedNoDate: "İzlenenler listenizde",
    watchedUpTo: "Son izlenen",
    partnerMovedOn: (name: string, progress: string) => `${name} ilerlemeyi zaten güncelledi: ${progress}.`,
    yourRating: "Puanın",
    optional: "isteğe bağlı",
    notOnList: "Kaydedince listenize eklenir.",
    save: "Kaydet",
    saving: "Kaydediliyor…",
    notNow: "Şimdi değil",
  },
  review: {
    heading: "Yorumlar",
    yours: "Yorumun",
    placeholder: "İstersen birkaç satır yaz",
    hint: (name: string) => `${name} kendi yorumunu yazınca seninkini görecek.`,
    partnerHidden: (name: string) => `${name} kendi yorumunu yazdı: görmek için seninkini yaz.`,
    partnerShown: (name: string) => `Yazan: ${name}`,
    count: (n: number, max: number) => `${n}/${max}`,
    save: "Yorumu kaydet",
    cancel: "Vazgeç",
    willDelete: "Boş kaydedersen yorumun silinir.",
  },
  errors: {
    gone: "Bu izleme gecesi artık yok.",
    notOver: "Bu izleme gecesi henüz bitmedi.",
    noSuchItem: "Bu artık listenizde değil.",
    tooLong: (max: number) => `Yorum en fazla ${max} karakter olabilir.`,
    saveFailed: "Kaydedilemedi. Tekrar dene.",
  },
};

const messages = { en, tr };
export default messages;
