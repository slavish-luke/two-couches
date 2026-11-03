/** "Pick for tonight": how long you have, and one suggestion at a time. */
const en = {
  heading: "Pick for tonight",
  intro: "Say how long you have and get one thing to watch at a time, from your list first.",
  homeLink: {
    heading: "Pick something for tonight",
    body: "Say how long you have and get one title that fits.",
  },
  time: {
    label: "How long do you have?",
    quick: "Quick choices",
    late: "Until it's too late for one of us",
    custom: "Minutes",
    go: "Pick",
  },
  /** The summary of the time chosen. `length` is from title.runtime(). */
  have: (length: string) => `You have ${length}.`,
  untilLate: {
    you: (time: string, length: string) => `Until ${time} for you: ${length}.`,
    partner: (name: string, time: string, yourTime: string, length: string) =>
      `Until ${time} for ${name} (${yourTime} for you): ${length}.`,
    tooLateYou: "It's already too late for you tonight. Pick a number of minutes instead.",
    tooLatePartner: (name: string) => `It's already too late tonight for ${name}. Pick a number of minutes instead.`,
  },
  bothOnly: "Only what we can both watch",
  /** Why this one came up. */
  reasons: {
    watching: "You're watching it",
    upTo: (progress: string) => `You're up to ${progress}`,
    onListSince: (date: string) => `On your list since ${date}`,
    because: (title: string) => `Suggested because you liked ${title}`,
  },
  length: {
    film: (runtime: string) => runtime,
    episode: (runtime: string) => `${runtime} an episode`,
    episodeGuess: (runtime: string) => `About ${runtime} an episode`,
    unknown: "Length unknown",
  },
  services: {
    you: (services: string) => `You: ${services}`,
    partner: (name: string, services: string) => `${name}: ${services}`,
  },
  another: "Another",
  planIt: "Plan it",
  watchNow: "Watch now",
  startOver: "Start again",
  /** Shown once "Another" has gone through everything. */
  wrapped: "That's everything that fits: back to the first.",
  empty: {
    heading: (length: string) => `Nothing fits in ${length}`,
    noList: "Your Up next list is empty. Add a few titles and they'll show up here.",
    tryEverything: "Include what only one of you can watch",
    tryLonger: "Try more time",
  },
  failed: "Couldn't load suggestions just now. Try again in a moment.",
};

const tr: typeof en = {
  heading: "Bu akşam ne izlesek?",
  intro: "Ne kadar vaktiniz olduğunu söyleyin, önce listenizden olmak üzere teker teker öneri alın.",
  homeLink: {
    heading: "Bu akşam için bir şey seç",
    body: "Ne kadar vaktiniz olduğunu söyleyin, sığan bir yapım gelsin.",
  },
  time: {
    label: "Ne kadar vaktiniz var?",
    quick: "Hızlı seçenekler",
    late: "Birimiz için çok geç olana kadar",
    custom: "Dakika",
    go: "Seç",
  },
  have: (length: string) => `Vaktiniz: ${length}.`,
  untilLate: {
    you: (time: string, length: string) => `Senin için saat ${time} olana kadar: ${length}.`,
    partner: (name: string, time: string, yourTime: string, length: string) =>
      `${name} için saat ${time} olana kadar (senin saatinle ${yourTime}): ${length}.`,
    tooLateYou: "Bu akşam senin için artık çok geç. Bunun yerine dakika seç.",
    tooLatePartner: (name: string) => `${name} için bu akşam artık çok geç. Bunun yerine dakika seç.`,
  },
  bothOnly: "Sadece ikimizin de izleyebildikleri",
  reasons: {
    watching: "İzliyorsunuz",
    upTo: (progress: string) => `Kaldığınız yer: ${progress}`,
    onListSince: (date: string) => `Listenize eklendiği tarih: ${date}`,
    because: (title: string) => `Beğendiğiniz için önerildi: ${title}`,
  },
  length: {
    film: (runtime: string) => runtime,
    episode: (runtime: string) => `Bölüm başı ${runtime}`,
    episodeGuess: (runtime: string) => `Bölüm başı yaklaşık ${runtime}`,
    unknown: "Süresi bilinmiyor",
  },
  services: {
    you: (services: string) => `Sen: ${services}`,
    partner: (name: string, services: string) => `${name}: ${services}`,
  },
  another: "Başka",
  planIt: "Planla",
  watchNow: "Şimdi izle",
  startOver: "Baştan başla",
  wrapped: "Sığanların hepsi bu kadar: yeniden ilkinden başlıyoruz.",
  empty: {
    heading: (length: string) => `Bu süreye sığan bir şey yok: ${length}`,
    noList: "Sıradakiler listeniz boş. Birkaç yapım ekleyin, burada görünsünler.",
    tryEverything: "Sadece birinizin izleyebildiklerini de göster",
    tryLonger: "Daha uzun bir süre dene",
  },
  failed: "Öneriler şu an yüklenemedi. Birazdan tekrar dene.",
};

const messages = { en, tr };
export default messages;
