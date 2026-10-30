// Blessing by the track with the heal's excess as a lasting Shield (the
// owner, 2026-10-30; `ABILITY.blessing.trackShield`, at most `cap` 3), range
// 3, by `scale` `bands` and `cap`, against Blessing as built. The seats of
// priest-track.mjs. `modWinPct` throughout.
const regions = {
  steppe: ['bokh', 'mangudai', 'storm'],
  china: ['modao', 'youxia', 'alchemist'],
  persia: ['mahout', 'archer', 'magus'],
};
const byzantium = ['cataphract', 'varangian', 'priest'];
const seat = (party, i, hero) => party.map((h, j) => (j === i ? hero : h));
const track = (scale) => (c) =>
  Object.assign(c.ABILITY.blessing, {mode: 'track', scale, range: 3, trackShield: true});
const variants = {built: () => {}, bandsShield: track('bands'), capShield: track('cap')};
const novice = {depth: 1, work: 220};
const expert = {depth: 4, work: 4 * 220};
export const experiments = {};
for (const [v, patch] of Object.entries(variants)) {
  for (const [name, party] of Object.entries(regions)) {
    experiments[`${v}-priest-for-${party[2]}-${name}`] = {
      party,
      patch,
      mod: {party: seat(party, 2, 'priest')},
    };
    experiments[`${v}-${party[2]}-for-priest-byzantium`] = {
      party: byzantium,
      patch,
      mod: {party: seat(byzantium, 2, party[2])},
    };
  }
  for (const [level, search] of [
    ['novice', novice],
    ['expert', expert],
  ])
    experiments[`${v}-${level}-priest`] = {
      party: seat(regions.steppe, 2, 'priest'),
      patch,
      mod: {search, searchHeroes: ['priest']},
    };
}
