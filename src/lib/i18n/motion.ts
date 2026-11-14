/**
 * Motion (Phase 10): comic sound words that pop up in POW! Comic Book (sfx() in src/lib/fx.ts), and the
 * Motion setting. Sound words are decoration and never read out.
 */
const en = {
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
