// Blessing by the track (the owner's idea, 2026-10-30; `ABILITY.blessing.mode`
// `track`): no Shield, range 3, an ally whose card is under 5 slots on
// healed and an enemy's over 5 hit, by `scale` `bands` (his power, half of it
// a slot either side of 5) or `cap` (1 a slot from 5, at most his power),
// against Blessing as built. The Priest in the support seat of the three
// other regions' mirrors, and each of their supports in his seat of
// Byzantium's (as roles-twelve.mjs), and played by a novice and an expert in
// a Steppe mirror (as skill-fights.mjs). `modWinPct` throughout.
const regions = {
  steppe: ['bokh', 'mangudai', 'storm'],
  china: ['modao', 'youxia', 'alchemist'],
  persia: ['mahout', 'archer', 'magus'],
};
const byzantium = ['cataphract', 'varangian', 'priest'];
const seat = (party, i, hero) => party.map((h, j) => (j === i ? hero : h));
const track = (scale) => (c) => Object.assign(c.ABILITY.blessing, {mode: 'track', scale, range: 3});
const variants = {built: () => {}, bands: track('bands'), cap: track('cap')};
const novice = {depth: 1, work: 220};
const expert = {depth: 4, work: 4 * 220};
export const experiments = {};
for (const [v, patch] of Object.entries(variants)) {
  for (const [name, party] of Object.entries(regions)) {
    experiments[`${v}-priest-for-${party[2]}-${name}`] = {party, patch, mod: {party: seat(party, 2, 'priest')}};
    experiments[`${v}-${party[2]}-for-priest-byzantium`] = {
      party: byzantium,
      patch,
      mod: {party: seat(byzantium, 2, party[2])},
    };
  }
  for (const [level, search] of [['novice', novice], ['expert', expert]])
    experiments[`${v}-${level}-priest`] = {
      party: seat(regions.steppe, 2, 'priest'),
      patch,
      mod: {search, searchHeroes: ['priest']},
    };
}
