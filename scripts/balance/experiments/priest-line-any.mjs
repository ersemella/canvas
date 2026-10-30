// Blessing in a line as built later 2026-10-30 (the owner): any of the six
// lines aimed, a unit on it or not, the Priest himself always blessed. The
// seats of priest-track.mjs, on the rules as built. `modWinPct` throughout.
const regions = {
  steppe: ['bokh', 'mangudai', 'storm'],
  china: ['modao', 'youxia', 'alchemist'],
  persia: ['mahout', 'archer', 'magus'],
};
const byzantium = ['cataphract', 'varangian', 'priest'];
const seat = (party, i, hero) => party.map((h, j) => (j === i ? hero : h));
const novice = {depth: 1, work: 220};
const expert = {depth: 4, work: 4 * 220};
export const experiments = {};
for (const [name, party] of Object.entries(regions)) {
  experiments[`priest-for-${party[2]}-${name}`] = {party, mod: {party: seat(party, 2, 'priest')}};
  experiments[`${party[2]}-for-priest-byzantium`] = {
    party: byzantium,
    mod: {party: seat(byzantium, 2, party[2])},
  };
}
for (const [level, search] of [
  ['novice', novice],
  ['expert', expert],
])
  experiments[`${level}-priest`] = {
    party: seat(regions.steppe, 2, 'priest'),
    mod: {search, searchHeroes: ['priest']},
  };
