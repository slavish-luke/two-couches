/**
 * Time together (Sprint 22): "I'm free tonight", the state under each Home clock, the "All our nights"
 * timeline and "Made in one of our countries" in Pick and Browse.
 */
const en = {
  free: {
    /** The card's label (screen readers; Candy shows it as the box's tab). */
    label: "Tonight",
    mine: {
      off: "I'm free tonight",
      on: "You're free tonight",
      undo: "Undo",
      /** Screen-reader text for the undo button. */
      undoLabel: "Take back that you're free tonight",
    },
    partner: {
      free: (name: string) => `${name} is free tonight`,
      unknown: (name: string) => `${name} hasn't said yet`,
    },
    both: {
      heading: "You're both free tonight!",
      slot: (mine: string, theirs: string, name: string) => `Best start: ${mine} for you, ${theirs} for ${name}.`,
      noSlot: "Your evenings don't overlap tonight: pick a time that works for both of you.",
      plan: "Plan a night",
    },
    failed: "Couldn't save that. Try again.",
    push: {
      one: { title: (name: string) => `${name} is free tonight`, body: "Are you? Say so on Home." },
      both: { title: "You're both free tonight", body: "Plan a watch night?" },
    },
  },
  clock: {
    free: "Free time",
    awake: "Busy hours",
    asleep: "Probably asleep",
    /** Screen-reader text: whose clock it is and what they're up to. */
    label: (name: string, state: string) => `${name}: ${state}`,
  },
  timeline: {
    link: "All our nights",
    heading: "All our nights",
    intro: "Every watch night you've had together, newest first.",
    back: "Watch nights",
    nights: (n: number) => (n === 1 ? "1 night" : `${n} nights`),
    since: (date: string) => `since ${date}`,
    streak: (n: number) => (n === 1 ? "1 week in a row now" : `${n} weeks in a row now`),
    best: (n: number) => (n === 1 ? "Best: 1 week in a row" : `Best: ${n} weeks in a row`),
    number: (n: number) => `Night ${n}`,
    first: "Your first watch night",
    film: (n: number) => `Film #${n} together`,
    anniversary: (years: number) => (years === 1 ? "A year of watch nights!" : `${years} years of watch nights!`),
    decideLater: "Decided on the night",
    rewatch: "Rewatch",
    notRated: "Not rated",
    photos: (n: number) => (n === 1 ? "1 photo" : `${n} photos`),
    more: (n: number) => `+${n}`,
    showMore: "Show older nights",
    empty: "No watch nights yet. Once you've had one, it shows up here.",
    emptyLink: "Plan a watch night",
  },
  made: {
    /** The toggle in Browse and Pick. */
    ours: "Made in our countries",
    one: (country: string) => `Made in ${country}`,
    /** Its tooltip and screen-reader text: the countries by name. */
    names: (countries: string) => `Made in ${countries}`,
    or: " or ",
    anyCountry: "From any country",
  },
};

const tr: typeof en = {
  free: {
    label: "Bu akşam",
    mine: {
      off: "Bu akşam boşum",
      on: "Bu akşam boşsun",
      undo: "Geri al",
      undoLabel: "Bu akşam boş olduğunu geri al",
    },
    partner: {
      free: (name: string) => `${name} bu akşam boş`,
      unknown: (name: string) => `${name} henüz bir şey demedi`,
    },
    both: {
      heading: "Bu akşam ikiniz de boşsunuz!",
      slot: (mine: string, theirs: string, name: string) => `En uygun saat: senin için ${mine}, ${name} için ${theirs}.`,
      noSlot: "Bu akşam saatleriniz örtüşmüyor: ikinize de uyan bir zaman seçin.",
      plan: "Gece planla",
    },
    failed: "Kaydedilemedi. Tekrar dene.",
    push: {
      one: { title: (name: string) => `${name} bu akşam boş`, body: "Ya sen? Ana sayfadan söyle." },
      both: { title: "Bu akşam ikiniz de boşsunuz", body: "Bir izleme gecesi planlayalım mı?" },
    },
  },
  clock: {
    free: "Boş vakit",
    awake: "Yoğun saatler",
    asleep: "Uyuyordur",
    label: (name: string, state: string) => `${name}: ${state}`,
  },
  timeline: {
    link: "Tüm gecelerimiz",
    heading: "Tüm gecelerimiz",
    intro: "Birlikte geçirdiğiniz tüm izleme geceleri, en yenisi başta.",
    back: "İzleme geceleri",
    nights: (n: number) => `${n} gece`,
    since: (date: string) => `ilki: ${date}`,
    streak: (n: number) => `Şu an üst üste ${n} hafta`,
    best: (n: number) => `En iyisi: üst üste ${n} hafta`,
    number: (n: number) => `${n}. gece`,
    first: "İlk izleme geceniz",
    film: (n: number) => `Birlikte ${n}. film`,
    anniversary: (years: number) => `İzleme gecelerinde ${years}. yıl!`,
    decideLater: "O gece karar verildi",
    rewatch: "Yeniden izleme",
    notRated: "Puanlanmadı",
    photos: (n: number) => `${n} fotoğraf`,
    more: (n: number) => `+${n}`,
    showMore: "Daha eski geceler",
    empty: "Henüz izleme geceniz yok. İlk geceniz olunca burada görünecek.",
    emptyLink: "İzleme gecesi planla",
  },
  made: {
    ours: "Bizim ülkelerden",
    one: (country: string) => `Yapım ülkesi: ${country}`,
    names: (countries: string) => `Yapım ülkesi: ${countries}`,
    or: " veya ",
    anyCountry: "Her ülkeden",
  },
};

const messages = { en, tr };
export default messages;
