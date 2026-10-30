// The Duelist's jumps (the owner's idea, 2026-10-30;
// `ABILITY.swiftStrike.jump`): Swift Strike hits a unit next to it, or 2
// away in line, stepping one space in (`lunge` 1), or jumps a unit next to
// it to the free space past it, hitting it, and from there may jump
// another, and so on in the same turn, never the same unit twice. At walk 2
// with no Haste (the test stage's then), walk 3 with no Haste, and walk 2
// with Haste 3, against Swift Strike as built. Rows as duelist-lunge.mjs.
const regions = {
  steppe: ['bokh', 'mangudai', 'storm'],
  persia: ['mahout', 'archer', 'magus'],
  byzantium: ['cataphract', 'varangian', 'priest'],
};
const china = ['modao', 'youxia', 'alchemist'];
const seat = (party, i, hero) => party.map((h, j) => (j === i ? hero : h));
const kit = ({jump = false, walk = 3, haste = 3}) => (c) => {
  Object.assign(c.ABILITY.swiftStrike, {lunge: jump ? 1 : 0, jump, haste, passThrough: false, streak: []});
  c.HEROES.youxia.moveCap = walk;
};
const variants = {
  built: kit({}),
  'jump-w2-h0': kit({jump: true, walk: 2, haste: 0}),
  'jump-w3-h0': kit({jump: true, walk: 3, haste: 0}),
  'jump-w2-h3': kit({jump: true, walk: 2, haste: 3}),
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
