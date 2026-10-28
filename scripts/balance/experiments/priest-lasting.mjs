// A lasting Shield (owner's question, 2026-10-28): Blessing's Shield stays
// until damage spends it (`ABILITY.blessing.lasts`), a unit holding at most
// `cap` × the Priest's power. As built (heal, the rest Shield), and as a
// Shield in place of the heal on one ally or every ally within a radius
// (priest-shield.mjs's shapes). In the support seats of priest.mjs.
const steppe = ['bokh', 'mangudai', 'storm'];
const china = ['youxia', 'modao', 'alchemist'];
const persia = ['archer', 'mahout', 'magus'];
const seat = (party, i, hero) => party.map((h, j) => (j === i ? hero : h));
const lasting =
  (opts, power = 3) =>
  (c) => {
    Object.assign(c.ABILITY.blessing, {lasts: true, cap: 1, ...opts});
    c.HEROES.priest.power = power;
  };
const variants = {
  'heal-lasting': lasting({}),
  'shield-single': lasting({heal: false}),
  'shield-single-cap2': lasting({heal: false, cap: 2}),
  'shield-aura1': lasting({heal: false, shape: 'aura', radius: 1}),
  'shield-aura2-p2': lasting({heal: false, shape: 'aura', radius: 2}, 2),
};
export const experiments = {};
for (const [v, patch] of Object.entries(variants))
  for (const [name, party] of [
    ['steppe', steppe],
    ['china', china],
    ['persia', persia],
  ])
    experiments[`priest-${v}-${name}`] = {party, patch, mod: {party: seat(party, 2, 'priest')}};
