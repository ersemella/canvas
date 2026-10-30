// Leap (owner, 2026-10-30), the Barbarian's in place of Axe Throw, by its
// shape (`ABILITY.leap.shape`): `front` as built (the two spaces ahead of
// the landing, for his power), `forward` (those and the one either side,
// four for his power) and `splash` (the front two for his power, the other
// four next to the landing for `splash`, 1), with Axe Throw as he had it
// for a reference. The Barbarian in the damage seat of the three other
// regions' mirrors, and each of their damage heroes in his seat of
// Byzantium's (as roles-twelve.mjs). `modWinPct` throughout.
const regions = {
  steppe: ['bokh', 'mangudai', 'storm'],
  china: ['modao', 'youxia', 'alchemist'],
  persia: ['mahout', 'archer', 'magus'],
};
const byzantium = ['cataphract', 'varangian', 'priest'];
const seat = (party, i, hero) => party.map((h, j) => (j === i ? hero : h));
const shape = (s) => (c) => Object.assign(c.ABILITY.leap, {shape: s});
const variants = {
  axeThrow: (c) => {
    c.HEROES.varangian.abilities = ['axeThrow', 'hold'];
  },
  front: shape('front'),
  forward: shape('forward'),
  splash: shape('splash'),
};
export const experiments = {};
for (const [v, patch] of Object.entries(variants))
  for (const [name, party] of Object.entries(regions)) {
    experiments[`${v}-varangian-for-${party[1]}-${name}`] = {
      party,
      patch,
      mod: {party: seat(party, 1, 'varangian')},
    };
    experiments[`${v}-${party[1]}-for-varangian-byzantium`] = {
      party: byzantium,
      patch,
      mod: {party: seat(byzantium, 1, party[1])},
    };
  }
