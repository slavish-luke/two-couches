/** List and notes (Sprint 21): the Someday shelf, sending a title, hidden season reviews and Translate. */
const en = {
  shelf: {
    /** The view's heading, and the link to it under Up next. */
    heading: "Someday shelf",
    intro: "Titles for one day, not soon. They stay out of Up next, Pick, the swipe deck and alerts until you move one back.",
    /** The link under Up next; the count rides beside it. */
    open: "On the Someday shelf",
    back: "Back to Up next",
    empty: "Nothing on the shelf. When a title is for one day rather than soon, tap “Someday” on its card.",
    /** The one-tap button on a list card or the title page. */
    toShelf: "Someday",
    toNext: "Up next",
    toShelfLabel: (title: string) => `Put ${title} on the Someday shelf`,
    toNextLabel: (title: string) => `Move ${title} back to Up next`,
    /** On the title page while it's on the shelf. */
    onShelf: "On the Someday shelf: kept out of Up next, Pick and alerts.",
    moveBack: "Move it back to Up next",
    putAway: "Not soon? Put it on the Someday shelf",
    failed: "Couldn't move it. Try again.",
  },
  send: {
    /** The button on the title page and search results. */
    button: (name: string) => `Send to ${name}`,
    heading: (name: string) => `Send it to ${name}`,
    noteLabel: "A short note",
    optional: "optional",
    notePlaceholder: "Why this one?",
    count: (n: number, max: number) => `${n}/${max}`,
    send: "Send",
    sending: "Sending…",
    cancel: "Cancel",
    /** After sending, until they answer. */
    sent: (name: string) => `Sent to ${name}: waiting for an answer`,
    takeBack: "Take it back",
    pushTitle: (name: string) => `${name} sent you a title`,
    pushBody: (title: string, note: string) => (note ? `${title}: “${note}”` : `${title}. Add it, keep it for someday, or wave it off.`),
    /** The card on the recipient's Home and title page. */
    label: "Sent to you",
    from: (name: string) => `${name} sent you this`,
    add: "Add to Up next",
    shelve: "Someday",
    wave: "Not for me",
    answered: {
      added: (name: string) => `You added it to Up next. ${name} can see that.`,
      shelved: (name: string) => `You put it on the Someday shelf. ${name} can see that.`,
      waved: (name: string) => `You waved it off. ${name} can see that.`,
    },
    /** On the sender's side once the partner has answered. */
    theyAnswered: {
      added: (name: string) => `${name} added it to Up next`,
      shelved: (name: string) => `${name} put it on the Someday shelf`,
      waved: (name: string) => `${name} waved it off`,
    },
    errors: {
      noPartner: "You need a partner to send things to.",
      tooLong: (max: number) => `Keep the note to ${max} characters.`,
      already: "You've already sent this one and it's waiting for an answer.",
      failed: "Couldn't send it. Try again.",
      gone: "That isn't waiting any more.",
      answerFailed: "Couldn't save that. Try again.",
    },
  },
  seasonReview: {
    write: "Review",
    edit: "Your review",
    /** Screen-reader label for a season's review box. */
    label: (season: number) => `Your review of season ${season}`,
    placeholder: "A line or two about this season",
    count: (n: number, max: number) => `${n}/${max}`,
    save: "Save",
    cancel: "Cancel",
    willDelete: "Saving it empty removes your review.",
    tooLong: (max: number) => `Keep it to ${max} characters.`,
    failed: "Couldn't save that. Try again.",
  },
  translate: {
    button: "Translate",
    original: "Show original",
    translating: "Translating…",
    /** Under translated text. */
    byBrowser: "Translated by your browser",
    google: "Translate on Google",
    failed: "Your browser couldn't translate it.",
    same: "That's already in English.",
  },
};

const tr: typeof en = {
  shelf: {
    heading: "Bir gün rafı",
    intro: "Yakında değil, bir gün izlemek istediklerimiz. Geri alana kadar Sırada listesine, akşam seçimine, birlikte kaydırmaya ve uyarılara girmezler.",
    open: "Bir gün rafında",
    back: "Sıraya dön",
    empty: "Rafta bir şey yok. Bir yapım yakında değil de bir gün içinse kartındaki “Bir gün” düğmesine dokun.",
    toShelf: "Bir gün",
    toNext: "Sıraya al",
    toShelfLabel: (title: string) => `Rafa kaldır: ${title}`,
    toNextLabel: (title: string) => `Sıraya geri al: ${title}`,
    onShelf: "Bir gün rafında: Sırada listesine, akşam seçimine ve uyarılara girmez.",
    moveBack: "Sıraya geri al",
    putAway: "Yakında değil mi? Bir gün rafına kaldır",
    failed: "Taşınamadı. Yeniden dene.",
  },
  send: {
    button: () => "Partnerine gönder",
    heading: () => "Partnerine gönder",
    noteLabel: "Kısa bir not",
    optional: "isteğe bağlı",
    notePlaceholder: "Neden bu?",
    count: (n: number, max: number) => `${n}/${max}`,
    send: "Gönder",
    sending: "Gönderiliyor…",
    cancel: "Vazgeç",
    sent: () => "Gönderildi: yanıt bekleniyor",
    takeBack: "Geri al",
    pushTitle: (name: string) => `${name} sana bir yapım gönderdi`,
    pushBody: (title: string, note: string) => (note ? `${title}: “${note}”` : `${title}. Sıraya ekle, bir gün rafına kaldır ya da geç.`),
    label: "Sana gönderilenler",
    from: (name: string) => `Gönderen: ${name}`,
    add: "Sıraya ekle",
    shelve: "Bir gün",
    wave: "Bana göre değil",
    answered: {
      added: (name: string) => `Sıraya ekledin. ${name} bunu görebilir.`,
      shelved: (name: string) => `Bir gün rafına kaldırdın. ${name} bunu görebilir.`,
      waved: (name: string) => `Geçtin. ${name} bunu görebilir.`,
    },
    theyAnswered: {
      added: (name: string) => `Sıraya ekleyen: ${name}`,
      shelved: (name: string) => `Rafa kaldıran: ${name}`,
      waved: (name: string) => `Geçen: ${name}`,
    },
    errors: {
      noPartner: "Bir şey göndermek için partnerin olmalı.",
      tooLong: (max: number) => `Not en fazla ${max} karakter olsun.`,
      already: "Bunu zaten gönderdin, yanıt bekleniyor.",
      failed: "Gönderilemedi. Yeniden dene.",
      gone: "Bu artık beklemiyor.",
      answerFailed: "Kaydedilemedi. Yeniden dene.",
    },
  },
  seasonReview: {
    write: "Yorum yaz",
    edit: "Yorumun",
    label: (season: number) => `${season}. sezon için yorumun`,
    placeholder: "Bu sezon hakkında bir iki cümle",
    count: (n: number, max: number) => `${n}/${max}`,
    save: "Kaydet",
    cancel: "Vazgeç",
    willDelete: "Boş kaydedersen yorumun silinir.",
    tooLong: (max: number) => `En fazla ${max} karakter olsun.`,
    failed: "Kaydedilemedi. Yeniden dene.",
  },
  translate: {
    button: "Çevir",
    original: "Aslını göster",
    translating: "Çevriliyor…",
    byBrowser: "Tarayıcın çevirdi",
    google: "Google Çeviri'de aç",
    failed: "Tarayıcın bunu çeviremedi.",
    same: "Bu zaten Türkçe.",
  },
};

const messages = { en, tr };
export default messages;
