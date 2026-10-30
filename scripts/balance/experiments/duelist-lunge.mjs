// The Duelist's lunge and streak (the owner's idea, 2026-10-30;
// `ABILITY.swiftStrike.lunge`, `.streak`): Swift Strike first walking up to
// 2 spaces straight at the first unit in line, the Duelist's walk cut to 2
// or 1, and its Haste growing 1, 2, 3 on turns striking running, against
// Swift Strike as built. The Duelist in the damage seat of the three other
// regions' mirrors, and each of their damage heroes in his seat of China's
// (as roles-twelve.mjs); his speed +1 in China's mirror (as
// provision-vs-card.mjs); and played by a novice and an expert in a Steppe
// mirror (as skill-fights.mjs). `modWinPct` throughout.
const regions = {
  steppe: ['bokh', 'mangudai', 'storm'],
  persia: ['mahout', 'archer', 'magus'],
  byzantium: ['cataphract', 'varangian', 'priest'],
};
const china = ['modao', 'youxia', 'alchemist'];
const seat = (party, i, hero) => party.map((h, j) => (j === i ? hero : h));
const kit = ({lunge = 0, walk = 3, streak = []}) => (c) => {
  Object.assign(c.ABILITY.swiftStrike, {lunge, streak});
  c.HEROES.youxia.moveCap = walk;
};
const variants = {
  built: kit({}),
  streak: kit({streak: [1, 2, 3]}),
  'lunge-w2': kit({lunge: 2, walk: 2}),
  'lunge-w1': kit({lunge: 2, walk: 1}),
  'lunge-w2-streak': kit({lunge: 2, walk: 2, streak: [1, 2, 3]}),
  'lunge-w1-streak': kit({lunge: 2, walk: 1, streak: [1, 2, 3]}),
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
