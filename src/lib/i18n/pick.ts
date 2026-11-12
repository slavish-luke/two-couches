/** "Pick for tonight": how long you have, and one suggestion at a time. */
const en = {
  heading: "Pick for tonight",
  intro: "Say how long you have and get one thing to watch at a time, from your list first.",
  homeLink: {
    heading: "Pick something for tonight",
    body: "Say how long you have and get one title that fits.",
    surprise: "Surprise us",
    swipe: "Swipe together",
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
  /** "Surprise us": the pick arrives with a shuffle. */
  surprise: {
    sfx: "Shuffle!",
  },
  /** The mood check-in on Pick and the swipe deck. */
  mood: {
    heading: "How are you feeling tonight?",
    hint: "Picks lean towards what suits both of your moods. It lasts until midnight on your clock.",
    names: { cosy: "Cosy", gripping: "Gripping", funny: "Funny", light: "Light", tired: "Tired" },
    you: "You",
    partner: (name: string, mood: string) => `${name}: ${mood}`,
    /** After the partner's name tag. */
    notYet: "hasn't said yet",
    failed: "Couldn't save your mood. Try again.",
  },
  /** /pick/swipe: each of you swipes the same deck; a title you both say yes to is a match. */
  swipe: {
    heading: "Swipe together",
    intro: "You each say yes or no to the same cards on your own screen. The first one you both say yes to is your match.",
    entry: {
      heading: "Can't agree? Swipe together",
      body: "The same deck on both screens. Say yes or no, and see what you both want.",
    },
    back: "Back to Pick",
    yes: "Yes",
    no: "No",
    undo: "Undo",
    yesStamp: "Yes!",
    noStamp: "Nope",
    /** The card's accessible name. */
    card: (title: string, n: number, total: number) => `${title}, card ${n} of ${total}`,
    keys: "Swipe the card, tap Yes or No, or use the arrow keys.",
    progress: (done: number, total: number) => `You've swiped ${done} of ${total}`,
    partnerCount: (name: string, count: number) => `${name} has swiped ${count} ${count === 1 ? "card" : "cards"}`,
    partnerNone: (name: string) => `${name} hasn't started yet`,
    startAgain: "Start again",
    match: {
      word: "Match!",
      heading: "You both said yes",
      planIt: "Plan it",
      watchNow: "Watch now",
      keepSwiping: "Keep swiping",
      /** Read out when a match arrives. */
      announce: (title: string) => `It's a match: ${title}`,
    },
    matches: "Your matches today",
    done: {
      heading: "That's the whole deck",
      body: (name: string) => `If ${name} says yes to one you liked, it'll show up here as a match.`,
      bodyAlone: "Your partner's yeses will show up here once they've joined.",
    },
    empty: {
      heading: "Nothing to swipe yet",
      body: "Add a few titles to Up next, or rate some you've watched for For you, and they'll be dealt here.",
    },
    tryEverything: "Include what only one of you can watch",
    failed: "Couldn't save that swipe. Try again.",
  },
};

const tr: typeof en = {
  heading: "Bu akşam ne izlesek?",
  intro: "Ne kadar vaktiniz olduğunu söyleyin, önce listenizden olmak üzere teker teker öneri alın.",
  homeLink: {
    heading: "Bu akşam için bir şey seç",
    body: "Ne kadar vaktiniz olduğunu söyleyin, sığan bir yapım gelsin.",
    surprise: "Bizi şaşırt",
    swipe: "Birlikte kaydırın",
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
  surprise: {
    sfx: "Karıştır!",
  },
  mood: {
    heading: "Bu akşam nasıl hissediyorsun?",
    hint: "Öneriler ikinizin de ruh haline uyanlara yönelir. Senin saatinle gece yarısına kadar geçerli.",
    names: { cosy: "Sıcacık", gripping: "Sürükleyici", funny: "Komik", light: "Hafif", tired: "Yorgun" },
    you: "Sen",
    partner: (name: string, mood: string) => `${name}: ${mood}`,
    notYet: "henüz seçmedi",
    failed: "Ruh halin kaydedilemedi. Tekrar dene.",
  },
  swipe: {
    heading: "Birlikte kaydırın",
    intro: "İkiniz de kendi ekranınızda aynı kartlara evet ya da hayır dersiniz. İkinizin de evet dediği ilk yapım eşleşmenizdir.",
    entry: {
      heading: "Karar veremiyor musunuz? Birlikte kaydırın",
      body: "İki ekranda aynı deste. Evet ya da hayır deyin, ikinizin de ne istediğini görün.",
    },
    back: "Seçime dön",
    yes: "Evet",
    no: "Hayır",
    undo: "Geri al",
    yesStamp: "Evet!",
    noStamp: "Geç",
    card: (title: string, n: number, total: number) => `${title}, kart ${n} / ${total}`,
    keys: "Kartı kaydır, Evet ya da Hayır'a dokun veya ok tuşlarını kullan.",
    progress: (done: number, total: number) => `Kaydırdığın: ${done} / ${total}`,
    partnerCount: (name: string, count: number) => `Kaydırılan kart: ${count} (${name})`,
    partnerNone: (name: string) => `${name} henüz başlamadı`,
    startAgain: "Baştan başla",
    match: {
      word: "Eşleşme!",
      heading: "İkiniz de evet dediniz",
      planIt: "Planla",
      watchNow: "Şimdi izle",
      keepSwiping: "Kaydırmaya devam",
      announce: (title: string) => `Eşleşme: ${title}`,
    },
    matches: "Bugünkü eşleşmeleriniz",
    done: {
      heading: "Destenin sonu",
      body: (name: string) => `Beğendiğin bir yapıma evet derse burada eşleşme olarak görünecek: ${name}`,
      bodyAlone: "Partnerin katıldığında onun evetleri burada görünecek.",
    },
    empty: {
      heading: "Henüz kaydırılacak bir şey yok",
      body: "Sıradakiler listenize birkaç yapım ekleyin ya da izlediklerinizi puanlayın; burada dağıtılsınlar.",
    },
    tryEverything: "Sadece birinizin izleyebildiklerini de göster",
    failed: "Kaydırma kaydedilemedi. Tekrar dene.",
  },
};

const messages = { en, tr };
export default messages;
