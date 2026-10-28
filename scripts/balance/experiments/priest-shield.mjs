// Blessing as a Shield in place of the heal (owner, 2026-10-28): the ally
// Shielded the Priest's power until its next turn (`ABILITY.blessing.heal`
// off), on one ally within 2 (`shape: 'unit'`) or on every ally within a
// radius of the Priest, himself too (`shape: 'aura'`, `radius`), at power
// 3 and 2. In the support seat of a Steppe, a China and a Persia mirror,
// as priest.mjs; `modWinPct` throughout.
const steppe = ['bokh', 'mangudai', 'storm'];
const china = ['youxia', 'modao', 'alchemist'];
const persia = ['archer', 'mahout', 'magus'];
const seat = (party, i, hero) => party.map((h, j) => (j === i ? hero : h));
const shield = (shape, radius, power) => (c) => {
  Object.assign(c.ABILITY.blessing, {heal: false, shape, radius});
  c.HEROES.priest.power = power;
};
const variants = {
  'single-p3': shield('unit', 1, 3),
  'aura1-p3': shield('aura', 1, 3),
  'aura1-p2': shield('aura', 1, 2),
  'aura2-p2': shield('aura', 2, 2),
  'aura2-p1': shield('aura', 2, 1),
};
export const experiments = {};
for (const [v, patch] of Object.entries(variants))
  for (const [name, party] of [
    ['steppe', steppe],
    ['china', china],
    ['persia', persia],
  ])
    experiments[`priest-${v}-${name}`] = {party, patch, mod: {party: seat(party, 2, 'priest')}};
