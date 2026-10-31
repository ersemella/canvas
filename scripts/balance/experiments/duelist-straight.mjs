// The Duelist walking straight (the owner's pick, 2026-10-31;
// `movesStraight` with his `moveCap`): up to 3 or 2 spaces along one of
// the six directions, as the Outrider moves but capped, against the walk
// to any space in reach; with Swift Strike as on the test stage then (a
// unit next to it, one 2 away in line stepping in, or a jump over one next
// to it, one a turn; Haste 1, 2, 3 on hits on turns running). Rows as
// duelist-lunge.mjs.
const regions = {
  steppe: ['bokh', 'mangudai', 'storm'],
  persia: ['mahout', 'archer', 'magus'],
  byzantium: ['cataphract', 'varangian', 'priest'],
};
const china = ['modao', 'youxia', 'alchemist'];
const seat = (party, i, hero) => party.map((h, j) => (j === i ? hero : h));
const kit = ({walk, straight}) => (c) => {
  Object.assign(c.ABILITY.swiftStrike, {
    lunge: 1,
    jump: true,
    chain: false,
    haste: 0,
    passThrough: false,
    streak: [1, 2, 3],
    streakResets: true,
  });
  c.HEROES.youxia.moveCap = walk;
  c.HEROES.youxia.movesStraight = straight;
};
const variants = {
  'w3-free': kit({walk: 3, straight: false}),
  'w3-straight': kit({walk: 3, straight: true}),
  'w2-free': kit({walk: 2, straight: false}),
  'w2-straight': kit({walk: 2, straight: true}),
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
