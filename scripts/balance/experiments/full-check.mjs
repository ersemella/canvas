// A full balance check on the game as built (2026-10-31): Wait in runs, the
// Barbarian Byzantium's tank (Lunge, Fury 5) and the Cataphract its damage
// hero (braced after a charge), the Priest's Invocation at 6 slots, the
// Alchemist's Overdose and Sedative, the Duelist's dash, Longshot without
// Pierce, the Magus's Omen. No patch: every row is the game as built.
// - `X-vs-Y`: region party against region party, each pair once.
// - `H-for-O-R`: each hero in its role's seat of the three other regions'
//   mirrors, as roles-twelve.mjs (Byzantium's party ordered tank, damage,
//   support, since the swap).
// - `novice-H`, `expert-H`: one hero played by a novice (depth 1) or an
//   expert (depth 4, 4x work) in its role's seat of a Steppe mirror, as
//   skill-fights.mjs; `L-R-party` a region's whole party so.
// `modWinPct` throughout.
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
const names = Object.keys(regions);
export const experiments = {};
for (const [i, a] of names.entries())
  for (const b of names.slice(i + 1))
    experiments[`${b}-vs-${a}`] = {party: regions[a], mod: {party: regions[b]}};
for (const [name, party] of Object.entries(regions))
  for (const [other, theirs] of Object.entries(regions))
    if (other !== name)
      for (const [i, out] of party.entries())
        experiments[`${theirs[i]}-for-${out}-${name}`] = {party, mod: {party: seat(party, i, theirs[i])}};
for (const party of Object.values(regions))
  for (const [i, hero] of party.entries())
    for (const [level, search] of [['novice', novice], ['expert', expert]])
      experiments[`${level}-${hero}`] = {party: seat(steppe, i, hero), mod: {search, searchHeroes: [hero]}};
for (const [name, party] of Object.entries(regions))
  for (const [level, search] of [['novice', novice], ['expert', expert]])
    experiments[`${level}-${name}-party`] = {party, mod: {search}};
