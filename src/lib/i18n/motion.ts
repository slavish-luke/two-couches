import type { MotionLevel } from "../theme";

/**
 * Motion (Phase 10): comic sound words that pop up in POW! Comic Book (sfx() in src/lib/fx.ts), and the
 * Motion setting. Sound words are decoration and never read out.
 */
const en = {
  /** Settings → On this device → Motion (src/app/settings/motion-settings.tsx). */
  setting: {
    heading: "Motion",
    intro: "How much the app moves on this phone or computer.",
    options: { calm: "Calm", lively: "Lively", wild: "Wild" } satisfies Record<MotionLevel, string>,
    notes: {
      calm: "Soft fades and small lifts. Nothing flies, shakes or bursts.",
      lively: "Buttons bounce, posters tilt, page titles land letter by letter and the rays drift.",
      wild: "Everything turned up: faster rays, foil on posters you can both watch, waving titles, confetti and sound words.",
    } satisfies Record<MotionLevel, string>,
    reducedNow: "This device asks for less motion, so the app keeps still whatever you choose here. You can change that in the device's accessibility settings.",
    reducedHint: "If this device is set to reduce motion, that always wins over this setting.",
    saved: "Saved on this device",
  },
  sfx: {
    add: "ZIP!",
    stamp: "THWACK!",
    drop: "PLOP!",
    both: "KA-POW!",
    heart: "SMOOCH!",
    ready: "YES!",
    five: "WOW!",
    same: "BINGO!",
    lights: "SHHH!",
    party: "WHOOPEE!",
  },
};

const tr: typeof en = {
  setting: {
    heading: "Hareket",
    intro: "Uygulamanın bu telefonda ya da bilgisayarda ne kadar hareket edeceği.",
    options: { calm: "Sakin", lively: "Canlı", wild: "Çılgın" },
    notes: {
      calm: "Yumuşak geçişler ve küçük kıpırdanmalar. Hiçbir şey uçmaz, sallanmaz, patlamaz.",
      lively: "Düğmeler zıplar, afişler eğilir, sayfa başlıkları harf harf iner, ışınlar yavaşça döner.",
      wild: "Her şey sonuna kadar: daha hızlı ışınlar, ikinizin de izleyebildiği afişlerde parıltı, dalgalanan başlıklar, konfeti ve ses yazıları.",
    },
    reducedNow: "Bu cihaz daha az hareket istiyor, bu yüzden burada ne seçersen seç uygulama sakin kalır. Bunu cihazın erişilebilirlik ayarlarından değiştirebilirsin.",
    reducedHint: "Cihaz hareketi azaltacak şekilde ayarlıysa her zaman o geçerli olur.",
    saved: "Bu cihaza kaydedildi",
  },
  sfx: {
    add: "VIIN!",
    stamp: "ŞAK!",
    drop: "PAT!",
    both: "KA-BUM!",
    heart: "MUCK!",
    ready: "EVET!",
    five: "VAY!",
    same: "TAMAM!",
    lights: "ŞŞŞ!",
    party: "YAŞASIN!",
  },
};

const messages = { en, tr };
export default messages;
