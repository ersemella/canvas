// Bloodlust (owner, later 2026-10-31; `BLOODLUST`), beside Fury on the
// Barbarian: whenever his hit damages an enemy, Empowered 1 for 10 slots.
// `bl`: refreshed, never above 1 (as built); `bls`: stacking, 1 more a hit,
// at most 3 (`BLOODLUST.stacks`). On the test stage's Lunge with Push 1,
// so beside lunge-push.mjs's rows (same seeds, same rows):
// - `${tag}-byzantium-vs-R`: Byzantium's party against each region's.
// - `${tag}-H-for-O-R`: the Barbarian in the other regions' tank seats, and
//   every other hero in a Byzantine seat beside him (its tank seat by the
//   other tanks, its damage and support seats beside him too).
// - `${tag}-novice-varangian`, `${tag}-expert-varangian`: his skill in the
//   Steppe's tank seat; `${tag}-L-byzantium-party` the whole party's.
// `modWinPct` throughout.
const variant = (stacks) => (c) => {
  c.ABILITY.lunge.push = 1;
  c.HEROES.varangian.passives = ['fury', 'bloodlust'];
  c.BLOODLUST.stacks = stacks;
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
for (const [tag, patch] of [['bl', variant(false)], ['bls', variant(true)]]) {
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
