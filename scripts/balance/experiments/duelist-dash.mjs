// The Duelist's dash (the owner's idea, 2026-10-31;
// `ABILITY.swiftStrike.dash`): walking straight, up to 3 spaces along one
// of the six directions (`movesStraight`, `moveCap` 3), and Swift Strike
// only a dash of exactly 3 spaces straight, through the units on the first
// two, each hit, to the free third, or 2 through a unit next to him with
// yurts or the edge on the third; no strike in place. With Haste 3 flat and
// with Haste 1, 2, 3 on hits on turns running. Rows as duelist-lunge.mjs.
const regions = {
  steppe: ['bokh', 'mangudai', 'storm'],
  persia: ['mahout', 'archer', 'magus'],
  byzantium: ['cataphract', 'varangian', 'priest'],
};
const china = ['modao', 'youxia', 'alchemist'];
const seat = (party, i, hero) => party.map((h, j) => (j === i ? hero : h));
const kit = ({haste = 0, streak = [], dashMin = 0}) => (c) => {
  Object.assign(c.ABILITY.swiftStrike, {
    dash: 3,
    dashMin,
    lunge: 0,
    jump: false,
    chain: false,
    passThrough: false,
    haste,
    streak,
    streakResets: true,
  });
  c.HEROES.youxia.moveCap = 3;
  c.HEROES.youxia.movesStraight = true;
};
const variants = {
  'dash-flat3': kit({haste: 3}),
  'dash-streak': kit({streak: [1, 2, 3]}),
  // A dash of 2 or 3, his choice, a unit passed on the way (owner, 2026-10-31).
  'dash23-flat3': kit({haste: 3, dashMin: 2}),
  'dash23-streak': kit({streak: [1, 2, 3], dashMin: 2}),
};
const novice = {depth: 1, work: 220};
const expert = {depth: 4, work: 4 * 220};
export const experiments = {};
for (const [v, patch] of Object.entries(variants)) {
  for (const [name, party] of Object.entries(regions)) {
    experiments[`${v}-youxia-for-${party[1]}-${name}`] = {party, patch, mod: {party: seat(party, 1, 'youxia')}};
    experiments[`${v}-${party[1]}-for-youxia-china`] = {party: china, patch, mod: {party: seat(china, 1, party[1])}};
  }
  experiments[`${v}-china-youxia-speed+1`] = {party: china, patch, mod: {stats: {youxia: {speed: 1}}}};
  for (const [level, search] of [['novice', novice], ['expert', expert]])
    experiments[`${v}-${level}-youxia`] = {
      party: seat(regions.steppe, 1, 'youxia'),
      patch,
      mod: {search, searchHeroes: ['youxia']},
    };
}
