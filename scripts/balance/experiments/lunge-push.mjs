// Lunge with a Push of 1 (owner, later 2026-10-31; the test stage's
// "lunge": {"push": 1}, `ABILITY.lunge.push`): the unit the Barbarian
// strikes is Pushed 1 away from him. Every row of full-check.mjs the
// Barbarian plays in, patched, to set beside its rows (same seeds, same
// code but the switch):
// - `push-byzantium-vs-R`: Byzantium's party against each region's.
// - `push-H-for-O-R`: the Barbarian in the other regions' tank seats, and
//   every other hero in a Byzantine seat beside him (its tank seat by the
//   other tanks, its damage and support seats beside him too).
// - `push-novice-varangian`, `push-expert-varangian`: his skill in the
//   Steppe's tank seat; `push-L-byzantium-party` the whole party's.
// `modWinPct` throughout.
const patch = (c) => {
  c.ABILITY.lunge.push = 1;
};
const steppe = ['bokh', 'mangudai', 'storm'];
const regions = {
  steppe,
  china: ['modao', 'youxia', 'alchemist'],
  persia: ['mahout', 'archer', 'magus'],
  byzantium: ['varangian', 'cataphract', 'priest'],
};
const seat = (party, i, hero) => party.map((h, j) => (j === i ? hero : h));
const novice = {depth: 1, work: 220};
const expert = {depth: 4, work: 4 * 220};
export const experiments = {};
for (const name of ['steppe', 'china', 'persia'])
  experiments[`push-byzantium-vs-${name}`] = {party: regions[name], patch, mod: {party: regions.byzantium}};
for (const [name, party] of Object.entries(regions))
  for (const [other, theirs] of Object.entries(regions))
    if (other !== name && (name === 'byzantium' || other === 'byzantium'))
      for (const [i, out] of party.entries())
        if (name === 'byzantium' || i === 0)
          experiments[`push-${theirs[i]}-for-${out}-${name}`] = {party, patch, mod: {party: seat(party, i, theirs[i])}};
for (const [level, search] of [['novice', novice], ['expert', expert]]) {
  experiments[`push-${level}-varangian`] = {party: seat(steppe, 0, 'varangian'), patch, mod: {search, searchHeroes: ['varangian']}};
  experiments[`push-${level}-byzantium-party`] = {party: regions.byzantium, patch, mod: {search}};
}
