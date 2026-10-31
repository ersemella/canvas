// Syzygy (owner, 2026-10-31; the test stage's Magus's in place of Omen): one
// of his six lines, any distance, through anything, and the cards of every
// unit on it rearranged on the track (each on a blank card of the deck, or
// swapped among themselves; `ABILITY.syzygy`). A `patch`, both sides, beside
// Omen as built (`omen-` rows, no patch).
// Roles, as roles-twelve.mjs: the Magus in the support seat of the three
// other regions' mirrors, and each other support in his seat of Persia's.
// Skill, as skill-fights.mjs: the Magus played by a novice (depth 1) or an
// expert (depth 4, 4x work) in the support seat of a Steppe mirror, against
// the same Magus at production's search. `modWinPct` throughout.
const syzygy = (c) => {
  c.HEROES.magus.abilities = ['syzygy', 'hold'];
};
const steppe = ['bokh', 'mangudai', 'storm'];
const regions = {
  steppe,
  china: ['modao', 'youxia', 'alchemist'],
  persia: ['mahout', 'archer', 'magus'],
  byzantium: ['cataphract', 'varangian', 'priest'],
};
const seat = (party, i, hero) => party.map((h, j) => (j === i ? hero : h));
const novice = {depth: 1, work: 220};
const expert = {depth: 4, work: 4 * 220};
export const experiments = {};
for (const [variant, patch] of [
  ['omen', undefined],
  ['syzygy', syzygy],
]) {
  const p = patch ? {patch} : {};
  for (const [name, party] of Object.entries(regions)) {
    if (name === 'persia') continue;
    experiments[`${variant}-magus-for-${party[2]}-${name}`] = {
      party,
      ...p,
      mod: {party: seat(party, 2, 'magus')},
    };
    experiments[`${variant}-${party[2]}-for-magus-persia`] = {
      party: regions.persia,
      ...p,
      mod: {party: seat(regions.persia, 2, party[2])},
    };
  }
  for (const [level, search] of [
    ['novice', novice],
    ['expert', expert],
  ])
    experiments[`${variant}-skill-magus-${level}`] = {
      party: seat(steppe, 2, 'magus'),
      ...p,
      mod: {search, searchHeroes: ['magus']},
    };
}
