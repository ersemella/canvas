// The owner's next variants (2026-10-27), as archer-magus.mjs measures, whose
// `built` rows are these files' baseline (same seeds): Longshot stopped by the
// first unit or yurt in line and Piercing, power 3 kept (`ABILITY.longshot.first`,
// `.pierce`), and Conjunction putting its first unit's card just after the
// Magus's current turn and its second's just after his next, in place of a
// swap (`ABILITY.conjunction.mode: 'bracket'`).
const steppe = ['bokh', 'mangudai', 'storm'];
const china = ['youxia', 'modao', 'alchemist'];
const seat = (party, i, hero) => party.map((h, j) => (j === i ? hero : h));
const archer = {
  'first+pierce': (c) => {
    Object.assign(c.ABILITY.longshot, {first: true, pierce: true});
  },
  'first+pierce+noCamel': (c) => {
    Object.assign(c.ABILITY.longshot, {first: true, pierce: true, camel: false});
  },
};
const magus = {
  bracket: (c) => {
    c.ABILITY.conjunction.mode = 'bracket';
  },
  'bracket+range3': (c) => {
    c.ABILITY.conjunction.mode = 'bracket';
    c.ABILITY.conjunction.range = 3;
  },
};
export const experiments = {};
for (const [hero, variants, steppeSeat, chinaSeat] of [
  ['archer', archer, 1, 0],
  ['magus', magus, 2, 2],
])
  for (const [v, patch] of Object.entries(variants))
    for (const [name, party, i] of [
      ['steppe', steppe, steppeSeat],
      ['china', china, chinaSeat],
    ])
      experiments[`${hero}-${v}-${name}`] = {party, patch, mod: {party: seat(party, i, hero)}};
// The bracket again with `once`: a unit put after the Magus's next turn can't
// be put there again until it has acted, so he can't hold one back for good.
for (const [name, party] of [
  ['steppe', steppe],
  ['china', china],
])
  for (const range of [2, 3])
    experiments[`magus-bracket+once${range === 3 ? '+range3' : ''}-${name}`] = {
      party,
      patch: (c) => Object.assign(c.ABILITY.conjunction, {mode: 'bracket', once: true, range}),
      mod: {party: seat(party, 2, 'magus')},
    };
