/** The Coming soon page, alerts (on the page and in push notifications) and reminders. */
const en = {
  heading: "Coming soon",
  intro: "New releases in your two countries, and news about titles you're waiting for.",
  typesLabel: "Films or series",
  alerts: {
    heading: "Streaming news",
    empty:
      "Nothing new yet. Once a day we check your list and reminders: anything that arrives on a service you pay for, turns free or leaves one shows up here.",
    both: "Now streaming for both of you",
    me: "Now streaming for you",
    partner: (name: string) => `Now streaming for ${name}`,
    /** e.g. "You: Netflix, Max". */
    services: (who: string, services: string) => `${who}: ${services}`,
    you: "You",
    free: { both: "Now free for both of you", me: "Now free for you", partner: (name: string) => `Now free for ${name}` },
    freeAds: {
      both: "Now free with ads for both of you",
      me: "Now free with ads for you",
      partner: (name: string) => `Now free with ads for ${name}`,
    },
    gone: {
      both: "No longer streaming for either of you",
      me: "No longer streaming for you",
      partner: (name: string) => `No longer streaming for ${name}`,
    },
    /** e.g. "You: left Netflix in GB". */
    left: (who: string, services: string, country: string) => `${who}: left ${services} in ${country}`,
    /** The tag on a "gone" alert's poster. */
    goneTag: "Gone",
    /** One notification standing in for several alerts. */
    summary: (count: number) => `News about ${count} titles you're waiting for.`,
  },
  reminders: {
    heading: "Reminders",
    note: "We'll tell you both when these start streaming.",
    remind: "Remind us",
    remindLong: "Remind us when it's streaming",
    on: "Reminder set",
    saving: "Saving…",
    stop: "Tap to stop the reminder",
    failed: "Couldn't save the reminder. Try again.",
  },
  cinemas: { heading: "In cinemas", note: "Out recently or coming up, in either of your countries" },
  digital: { heading: "Coming to digital", note: "Release dates for streaming, renting and buying" },
  /** A country with no release date for the film yet. */
  noDate: "No date yet",
  nextOnList: { heading: "Next episodes on our list", note: "Series you're watching or want to watch" },
  seasonPremiere: "New season",
  newEpisodes: { heading: "New episodes this fortnight", note: "On the services you each pay for" },
  nothingHere: "Nothing to show here right now.",
  failed: "Couldn't load upcoming releases from TMDB. Try again in a minute.",
};

const tr: typeof en = {
  heading: "Yakında",
  intro: "İki ülkenizdeki yeni çıkanlar ve beklediğiniz yapımlarla ilgili haberler.",
  typesLabel: "Film ya da dizi",
  alerts: {
    heading: "Yayın haberleri",
    empty:
      "Henüz yeni bir şey yok. Listenizi ve hatırlatmalarınızı her gün kontrol ediyoruz; abone olduğunuz bir platforma gelen, ücretsiz olan ya da platformdan kalkan her şey burada görünür.",
    both: "Artık ikiniz de izleyebilirsiniz",
    me: "Artık izleyebilirsin",
    partner: (name: string) => `Artık izleyebilir: ${name}`,
    services: (who: string, services: string) => `${who}: ${services}`,
    you: "Sen",
    free: {
      both: "Artık ikiniz de ücretsiz izleyebilirsiniz",
      me: "Artık ücretsiz izleyebilirsin",
      partner: (name: string) => `Artık ücretsiz izleyebilir: ${name}`,
    },
    freeAds: {
      both: "Artık ikiniz de reklamlı olarak ücretsiz izleyebilirsiniz",
      me: "Artık reklamlı olarak ücretsiz izleyebilirsin",
      partner: (name: string) => `Artık reklamlı olarak ücretsiz izleyebilir: ${name}`,
    },
    gone: {
      both: "Artık ikiniz de izleyemiyorsunuz",
      me: "Artık izleyemiyorsun",
      partner: (name: string) => `Artık izleyemiyor: ${name}`,
    },
    left: (who: string, services: string, country: string) => `${who}: ${services} (${country}) kataloğundan çıktı`,
    goneTag: "Kalktı",
    summary: (count: number) => `Beklediğiniz ${count} yapımla ilgili haberler var.`,
  },
  reminders: {
    heading: "Hatırlatmalar",
    note: "Bunlar yayına girdiğinde ikinize de haber vereceğiz.",
    remind: "Hatırlat",
    remindLong: "Yayına girince hatırlat",
    on: "Hatırlatma kuruldu",
    saving: "Kaydediliyor…",
    stop: "Hatırlatmayı kapatmak için dokun",
    failed: "Hatırlatma kaydedilemedi. Tekrar dene.",
  },
  cinemas: { heading: "Sinemalarda", note: "İki ülkenizden birinde yeni çıkan ya da yakında çıkacak" },
  digital: { heading: "Dijitale geliyor", note: "Yayın, kiralama ve satın alma için çıkış tarihleri" },
  noDate: "Tarih yok",
  nextOnList: { heading: "Listemizdeki dizilerin yeni bölümleri", note: "İzlediğiniz ya da izlemek istediğiniz diziler" },
  seasonPremiere: "Yeni sezon",
  newEpisodes: { heading: "Önümüzdeki iki hafta yeni bölümler", note: "Her birinizin abone olduğu platformlarda" },
  nothingHere: "Şu an burada gösterilecek bir şey yok.",
  failed: "Yakında çıkacaklar TMDB'den yüklenemedi. Bir dakika sonra tekrar dene.",
};

const messages = { en, tr };
export default messages;
