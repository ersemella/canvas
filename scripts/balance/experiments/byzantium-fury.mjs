// After byzantium-brace.mjs (owner, later 2026-10-31): Hew as a line (the
// first unit up to 2 away in a straight line, stepping in next to it;
// `ABILITY.hew.shape` `line`, no Shield) with Fury (Hastened 3 whenever
// hit, `FURY`) as asked (`fury`), and without it (`line`), to tell the
// two apart. The Cataphract braced as there. Every row of roles-twelve.mjs
// for `fury`, the rows with Byzantium in them for `line` (the rest the same
// as `fury`'s); the Barbarian's skill in the tank seat, as skill-fights.mjs.
// Run on the Priest's Invocation (in runs since `81e3d7c`'s day), so not
// beside byzantium-brace.mjs's rows. `modWinPct`.
const swap = (fury) => (c) => {
  Object.assign(c.HEROES.varangian, {
    speed: 1,
    defence: 3,
    power: 2,
    abilities: ['hew', 'hold'],
    passives: fury ? ['fury'] : [],
  });
  Object.assign(c.HEROES.cataphract, {speed: 2, defence: 2, power: 2, passives: []});
  Object.assign(c.ABILITY.hew, {shape: 'line', reach: 2, shieldPerHit: 0});
  c.ABILITY.charge.armour = 1;
  c.AI.caution.varangian = 0;
  c.AI.caution.cataphract = 1;
};
const steppe = ['bokh', 'mangudai', 'storm'];
const regions = {
  steppe,
  china: ['modao', 'youxia', 'alchemist'],
  persia: ['mahout', 'archer', 'magus'],
  byzantium: ['varangian', 'cataphract', 'priest'],
};
const seat = (party, i, hero) => party.map((h, j) => (j === i ? hero : h));
export const experiments = {};
for (const [variant, patch] of [['fury', swap(true)], ['line', swap(false)]]) {
  for (const [name, party] of Object.entries(regions))
    for (const [other, theirs] of Object.entries(regions))
      if (other !== name && (variant === 'fury' || name === 'byzantium' || other === 'byzantium'))
        for (const [i, out] of party.entries())
          experiments[`${variant}-${theirs[i]}-for-${out}-${name}`] = {party, patch, mod: {party: seat(party, i, theirs[i])}};
  for (const [level, search] of [['novice', {depth: 1, work: 220}], ['expert', {depth: 4, work: 4 * 220}]])
    experiments[`skill-${variant}-varangian-tank-${level}`] = {party: seat(steppe, 0, 'varangian'), patch, mod: {search, searchHeroes: ['varangian']}};
}
