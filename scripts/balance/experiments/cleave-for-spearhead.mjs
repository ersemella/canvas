// Spearhead taken off the Vanguard, Cleave's Delay raised in its place
// (2026-10-31): the Vanguard's six rows of roles-twelve.mjs, every
// Vanguard with Spearhead at range 2 as built (`spearhead-d6`) or without it
// (`HEROES.modao.passives` emptied) at Cleave's Delay 6–10
// (`ABILITY.cleave.delay`, both sides). `modWinPct` throughout.
const regions = {
  steppe: ['bokh', 'mangudai', 'storm'],
  china: ['modao', 'youxia', 'alchemist'],
  persia: ['mahout', 'archer', 'magus'],
  byzantium: ['cataphract', 'varangian', 'priest'],
};
const seat = (party, i, hero) => party.map((h, j) => (j === i ? hero : h));
const variants = {'spearhead-d6': [true, 6]};
for (const d of [6, 7, 8, 9, 10]) variants[`none-d${d}`] = [false, d];
export const experiments = {};
for (const [variant, [spearhead, delay]] of Object.entries(variants)) {
  const patch = (config) => {
    config.ABILITY.cleave.delay = delay;
    if (!spearhead) config.HEROES.modao.passives = [];
  };
  for (const [name, party] of Object.entries(regions))
    if (name !== 'china') {
      experiments[`${variant}-modao-for-${party[0]}-${name}`] = {
        party,
        patch,
        mod: {party: seat(party, 0, 'modao')},
      };
      experiments[`${variant}-${party[0]}-for-modao-china`] = {
        party: regions.china,
        patch,
        mod: {party: seat(regions.china, 0, party[0])},
      };
    }
}
