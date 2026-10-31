// Battle Cry (owner, later 2026-10-31; `BATTLE_CRY`) in place of the
// Barbarian's Fury, Bloodlust off: whenever he is hit, his card Hastened
// `self` and each ally's within 2, Humphrey too, `allies`. `bc3`: 3 and 3
// (as built, Spearhead's); `bc53`: 5 (Fury's) and 3; `bc5`: 5 and 5. On
// Lunge as built, no Push (the owner's, later 2026-10-31), so beside
// full-check.mjs's rows of the same names (Fury's; same seeds), the rows
// lunge-push.mjs runs:
// - `${tag}-byzantium-vs-R`: Byzantium's party against each region's.
// - `${tag}-H-for-O-R`: the Barbarian in the other regions' tank seats, and
//   every other hero in a Byzantine seat beside him (its tank seat by the
//   other tanks, its damage and support seats beside him too).
// - `${tag}-novice-varangian`, `${tag}-expert-varangian`: his skill in the
//   Steppe's tank seat; `${tag}-L-byzantium-party` the whole party's.
// `modWinPct` throughout.
const variant = (self, allies) => (c) => {
  c.HEROES.varangian.passives = ['battleCry'];
  Object.assign(c.BATTLE_CRY, {self, allies, range: 2});
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
for (const [tag, patch] of [['bc3', variant(3, 3)], ['bc53', variant(5, 3)], ['bc5', variant(5, 5)]]) {
for (const name of ['steppe', 'china', 'persia'])
  experiments[`${tag}-byzantium-vs-${name}`] = {party: regions[name], patch, mod: {party: regions.byzantium}};
for (const [name, party] of Object.entries(regions))
  for (const [other, theirs] of Object.entries(regions))
    if (other !== name && (name === 'byzantium' || other === 'byzantium'))
      for (const [i, out] of party.entries())
        if (name === 'byzantium' || i === 0)
          experiments[`${tag}-${theirs[i]}-for-${out}-${name}`] = {party, patch, mod: {party: seat(party, i, theirs[i])}};
for (const [level, search] of [['novice', novice], ['expert', expert]]) {
  experiments[`${tag}-${level}-varangian`] = {party: seat(steppe, 0, 'varangian'), patch, mod: {search, searchHeroes: ['varangian']}};
  experiments[`${tag}-${level}-byzantium-party`] = {party: regions.byzantium, patch, mod: {search}};
}
}
