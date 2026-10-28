// The owner's next variants (2026-10-27), as archer-magus.mjs measures, whose
// `built` rows are these files' baseline (same seeds): Longshot stopped by the
// first unit or yurt in line and Piercing, power 3 kept (`ABILITY.longshot.first`,
// `.pierce`), and Conjunction putting its first unit's card just after the
// Magus's current turn and its second's just after his next, in place of a
// swap (`ABILITY.omen.mode: 'bracket'`).
// Longshot's Delay is 3 as built since 2026-10-27, so each Archer row sets its own.
const steppe = ['bokh', 'mangudai', 'storm'];
const china = ['youxia', 'modao', 'alchemist'];
const seat = (party, i, hero) => party.map((h, j) => (j === i ? hero : h));
const archer = {
  'first+pierce': (c) => {
    Object.assign(c.ABILITY.longshot, {first: true, pierce: true, delay: 0});
  },
  'first+pierce+noCamel': (c) => {
    Object.assign(c.ABILITY.longshot, {first: true, pierce: true, camel: false, delay: 0});
  },
};
// The baseline swap is set by archer-magus.mjs; these set their own mode.
const magus = {
  bracket: (c) => {
    Object.assign(c.ABILITY.omen, {mode: 'bracket', range: 2});
  },
  'bracket+range3': (c) => {
    c.ABILITY.omen.mode = 'bracket';
    c.ABILITY.omen.range = 3;
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
      patch: (c) => Object.assign(c.ABILITY.omen, {mode: 'bracket', once: true, range}),
      mod: {party: seat(party, 2, 'magus')},
    };
// Then (2026-10-27): the first-unit Longshot with Push 1 or 2, and Conjunction
// putting its second unit just before the Magus's next turn (`mode: 'before'`),
// at range 2 and 3.
for (const [name, party, archerSeat] of [
  ['steppe', steppe, 1],
  ['china', china, 0],
]) {
  for (const push of [1, 2])
    experiments[`archer-first+pierce+push${push}-${name}`] = {
      party,
      patch: (c) => Object.assign(c.ABILITY.longshot, {first: true, pierce: true, delay: 0, push}),
      mod: {party: seat(party, archerSeat, 'archer')},
    };
  for (const range of [2, 3])
    experiments[`magus-before${range === 3 ? '+range3' : ''}-${name}`] = {
      party,
      patch: (c) => Object.assign(c.ABILITY.omen, {mode: 'before', range}),
      mod: {party: seat(party, 2, 'magus')},
    };
}
// Then (2026-10-27): the first-unit Longshot with an effect other than Push:
// Delay 2 or 3, Weaken 1 or 2, or pinned (Immobilized through its next turn).
const effects = {
  delay2: {delay: 2},
  delay3: {delay: 3},
  weaken1: {weaken: 1},
  weaken2: {weaken: 2},
  pin: {pin: true},
};
for (const [name, party, archerSeat] of [
  ['steppe', steppe, 1],
  ['china', china, 0],
])
  for (const [e, switches] of Object.entries(effects))
    experiments[`archer-first+pierce+${e}-${name}`] = {
      party,
      patch: (c) =>
        Object.assign(c.ABILITY.longshot, {first: true, pierce: true, delay: 0, ...switches}),
      mod: {party: seat(party, archerSeat, 'archer')},
    };
