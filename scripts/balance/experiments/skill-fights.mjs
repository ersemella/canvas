// Skill on current main: each of the twelve heroes played by a novice
// (depth 1) or an expert (depth 4, 4x work) in its role's seat of a Steppe
// mirror on both sides (as roster-check.mjs), and each region's whole party.
const steppe = ['bokh', 'mangudai', 'storm'];
const regions = {
  steppe,
  china: ['modao', 'youxia', 'alchemist'],
  persia: ['mahout', 'archer', 'magus'],
  byzantium: ['cataphract', 'varangian', 'priest'],
};
const novice = {depth: 1, work: 220};
const expert = {depth: 4, work: 4 * 220};
const seat = (party, i, hero) => party.map((h, j) => (j === i ? hero : h));
export const experiments = {};
for (const party of Object.values(regions))
  for (const [i, hero] of party.entries())
    for (const [level, search] of [['novice', novice], ['expert', expert]])
      experiments[`${level}-${hero}`] = {party: seat(steppe, i, hero), mod: {search, searchHeroes: [hero]}};
for (const [name, party] of Object.entries(regions))
  for (const [level, search] of [['novice', novice], ['expert', expert]])
    experiments[`${level}-${name}-party`] = {party, mod: {search}};
