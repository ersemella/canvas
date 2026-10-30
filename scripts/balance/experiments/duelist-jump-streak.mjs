// The Duelist's jumps without the chain, its Haste growing with its hits
// (the owner's idea, 2026-10-30): Swift Strike as in duelist-jump.mjs (a
// unit next to it, one 2 away in line stepping in, or a jump over one next
// to it) but one a turn (`ABILITY.swiftStrike.chain` off), its Haste 1, 2,
// then 3 on hits on turns running (`streak`, a turn without one starting
// it again) or on every hit of the fight (`streakResets` off). Rows as
// duelist-lunge.mjs.
const regions = {
  steppe: ['bokh', 'mangudai', 'storm'],
  persia: ['mahout', 'archer', 'magus'],
  byzantium: ['cataphract', 'varangian', 'priest'],
};
const china = ['modao', 'youxia', 'alchemist'];
const seat = (party, i, hero) => party.map((h, j) => (j === i ? hero : h));
const kit = ({walk = 2, streak = [], resets = true}) => (c) => {
  Object.assign(c.ABILITY.swiftStrike, {
    lunge: 1,
    jump: true,
    chain: false,
    haste: 0,
    passThrough: false,
    streak,
    streakResets: resets,
  });
  c.HEROES.youxia.moveCap = walk;
};
const variants = {
  'nochain-w2-h0': kit({}),
  'nochain-w2-streak': kit({streak: [1, 2, 3]}),
  'nochain-w2-buildup': kit({streak: [1, 2, 3], resets: false}),
  'nochain-w3-streak': kit({walk: 3, streak: [1, 2, 3]}),
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
