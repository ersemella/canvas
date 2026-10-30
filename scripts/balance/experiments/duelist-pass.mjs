// The Duelist's lunge through units (the owner's idea, 2026-10-30;
// `ABILITY.swiftStrike.passThrough`): Swift Strike's lunge of 2 with his
// walk cut to 2, Haste 3 flat, passing through the unit next to him (hit
// as it goes by) to the free space past it, striking the unit in front of
// that too; against the lunge that stops at the first unit, and Swift
// Strike as built. Rows as duelist-lunge.mjs.
const regions = {
  steppe: ['bokh', 'mangudai', 'storm'],
  persia: ['mahout', 'archer', 'magus'],
  byzantium: ['cataphract', 'varangian', 'priest'],
};
const china = ['modao', 'youxia', 'alchemist'];
const seat = (party, i, hero) => party.map((h, j) => (j === i ? hero : h));
const kit = ({lunge = 0, walk = 3, passThrough = false}) => (c) => {
  Object.assign(c.ABILITY.swiftStrike, {lunge, passThrough, streak: []});
  c.HEROES.youxia.moveCap = walk;
};
const variants = {
  built: kit({}),
  'lunge-w2': kit({lunge: 2, walk: 2}),
  'lunge-w2-pass': kit({lunge: 2, walk: 2, passThrough: true}),
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
