/** The stats page: your year (or all time) in films and series. */
const en = {
  heading: "Stats",
  periodsLabel: "Which year",
  allTime: "All time",
  intro: (year: number | null) => (year ? `Your ${year} in films and series, together.` : "Everything you've watched together."),
  tiles: {
    films: "Films watched",
    series: "Series finished",
    hours: "Hours watched",
    nights: "Watch nights",
  },
  /** Under the hours when some runtimes are unknown. */
  atLeast: "at least",
  months: {
    heading: "Month by month",
    /** Tooltip and screen-reader text for one month's column. */
    count: (month: string, count: number) => `${month}: ${count === 1 ? "1 title" : `${count} titles`}`,
  },
  genres: { heading: "Top genres" },
  added: {
    heading: "Who added what",
    intro: "Titles each of you put on the list.",
    total: (name: string, count: number) => `${name}: ${count}`,
  },
  ratings: {
    heading: "Ratings",
    average: "Average rating",
    noRatings: "No ratings yet",
    favourites: "Your favourites together",
    split: "Split decision",
    splitIntro: "The one you disagreed on most.",
  },
  empty: {
    heading: "Nothing watched yet",
    body: "Mark titles as watched on your list and your stats appear here.",
    year: (year: number) => `Nothing marked as watched in ${year} yet.`,
    openList: "Open our list",
  },
};

const tr: typeof en = {
  heading: "İstatistikler",
  periodsLabel: "Hangi yıl",
  allTime: "Tüm zamanlar",
  intro: (year: number | null) => (year ? `${year} yılında birlikte izledikleriniz.` : "Birlikte izlediğiniz her şey."),
  tiles: {
    films: "İzlenen film",
    series: "Bitirilen dizi",
    hours: "İzleme saati",
    nights: "İzleme gecesi",
  },
  atLeast: "en az",
  months: {
    heading: "Ay ay",
    count: (month: string, count: number) => `${month}: ${count} yapım`,
  },
  genres: { heading: "En çok izlenen türler" },
  added: {
    heading: "Kim ne ekledi",
    intro: "Her birinizin listeye eklediği yapımlar.",
    total: (name: string, count: number) => `${name}: ${count}`,
  },
  ratings: {
    heading: "Puanlar",
    average: "Ortalama puan",
    noRatings: "Henüz puan yok",
    favourites: "Birlikte en sevdikleriniz",
    split: "Fikir ayrılığı",
    splitIntro: "En çok anlaşamadığınız yapım.",
  },
  empty: {
    heading: "Henüz izlenen bir şey yok",
    body: "Listende yapımları izlendi olarak işaretle, istatistiklerin burada görünsün.",
    year: (year: number) => `${year} yılında henüz izlendi olarak işaretlenen bir şey yok.`,
    openList: "Listemizi aç",
  },
};

const messages = { en, tr };
export default messages;
