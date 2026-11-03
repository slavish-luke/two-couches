/** Places and services: same couch mode (visits) and the subscription advisor, in Settings and on home. */
const en = {
  visit: {
    heading: "Travelling",
    intro:
      "Visiting your partner, or away together? Until the date you pick, your list, Browse and Coming soon use the country you're in. Your services come with you (the ones offered there will match), and your language, time zone and daily alerts stay as they are at home.",
    country: "I'm in",
    chooseCountry: "Choose a country…",
    until: "Until (the last day)",
    save: "Save",
    saving: "Saving…",
    current: (country: string, date: string) => `You're in ${country} until ${date}.`,
    end: "I'm back home",
    ending: "One moment…",
    errors: {
      country: "Pick the country you're in.",
      home: "That's your home country. Pick the one you're visiting.",
      date: "Pick a last day between today and a year from now.",
      saveFailed: "Couldn't save. Try again.",
    },
  },
  /** The chip on the home page's person cards while a visit is on. */
  chip: (code: string, date: string) => `In ${code} until ${date}`,
  advisor: {
    heading: "What would another service get you?",
    intro: (country: string) =>
      `Services in ${country} you don't pay for, and what they'd add from your Up next list. Your partner's services stay as they are.`,
    forBoth: (count: number) => (count === 1 ? "1 title for both of you" : `${count} titles for both of you`),
    forYou: (count: number) => (count === 1 ? "1 for you" : `${count} for you`),
    more: (count: number) => `+${count}`,
    emptyList: "Add films and series to Up next to see what another service would get you.",
    nothing: "No other service carries anything on Up next that you can't already stream.",
    idle: (service: string) => `Nothing on your list needs ${service} right now.`,
    saveFirst: "Counts use your saved services.",
  },
};

const tr: typeof en = {
  visit: {
    heading: "Seyahat",
    intro:
      "Partnerini mi ziyaret ediyorsun, yoksa birlikte seyahatte misiniz? Seçtiğin tarihe kadar listen, Keşfet ve Yakında, bulunduğun ülkeye göre çalışır. Servislerin seninle gelir (orada da sunulanlar eşleşir); dilin, saat dilimin ve günlük bildirimlerin evdeki gibi kalır.",
    country: "Bulunduğum ülke",
    chooseCountry: "Bir ülke seç…",
    until: "Son gün",
    save: "Kaydet",
    saving: "Kaydediliyor…",
    current: (country: string, date: string) => `Şu an buradasın: ${country}, son gün ${date}.`,
    end: "Eve döndüm",
    ending: "Bir saniye…",
    errors: {
      country: "Bulunduğun ülkeyi seç.",
      home: "Bu senin kendi ülken. Ziyaret ettiğin ülkeyi seç.",
      date: "Bugün ile bir yıl sonrası arasında bir son gün seç.",
      saveFailed: "Kaydedilemedi. Tekrar dene.",
    },
  },
  chip: (code: string, date: string) => `${code}, son gün ${date}`,
  advisor: {
    heading: "Başka bir servis sana ne kazandırır?",
    intro: (country: string) =>
      `Ödemediğin servisler (ülke: ${country}) ve Sıradakiler listenize neler ekleyecekleri. Partnerinin servisleri olduğu gibi kalır.`,
    forBoth: (count: number) => `İkiniz için ${count} yapım`,
    forYou: (count: number) => `Senin için ${count}`,
    more: (count: number) => `+${count}`,
    emptyList: "Başka bir servisin sana ne kazandıracağını görmek için Sıradakiler'e film ve dizi ekle.",
    nothing: "Sıradakiler'de izleyemediğin bir şeyi sunan başka bir servis yok.",
    idle: (service: string) => `Şu an listende şunu gerektiren bir şey yok: ${service}.`,
    saveFirst: "Sayılar kayıtlı servislerine göre.",
  },
};

const messages = { en, tr };
export default messages;
