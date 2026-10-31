// Byzantium's tank and damage hero swapped (owner, 2026-10-31), as the
// test stage has them: the Barbarian a tank (speed 1, defence 3, power 2,
// the AI's tank caution 0), his Leap striking the four spaces in front of
// where he lands (`ABILITY.leap.shape` `forward`) with Shield 1 for each
// enemy hit for 8 slots (`.perHit`); the Cataphract the damage hero
// (speed 2, defence 2, power 2, caution 1) without Armoured, Charge as
// built. Both sides.
//
// Roles: every row of roles-twelve.mjs (each hero in its role's seat of
// the three other regions' mirrors), Byzantium's party ordered tank,
// damage, support, as built (`built-`) and swapped (`swap-`).
// Skill: as skill-fights.mjs, a novice (depth 1) or an expert (depth 4,
// 4x work) in its role's seat of a Steppe mirror, the two swapped heroes
// in their new seats and as built in their old; the other damage heroes
// as built (their tanks measured on 2026-10-31); and Byzantium's party.
// `modWinPct` throughout.
const swap = (c) => {
  Object.assign(c.HEROES.varangian, {speed: 1, defence: 3, power: 2});
  Object.assign(c.HEROES.cataphract, {speed: 2, defence: 2, power: 2, passives: []});
  Object.assign(c.ABILITY.leap, {shape: 'forward', perHit: 1});
  c.AI.caution.varangian = 0;
  c.AI.caution.cataphract = 1;
};
const steppe = ['bokh', 'mangudai', 'storm'];
const regions = (swapped) => ({
  steppe,
  china: ['modao', 'youxia', 'alchemist'],
  persia: ['mahout', 'archer', 'magus'],
  byzantium: swapped ? ['varangian', 'cataphract', 'priest'] : ['cataphract', 'varangian', 'priest'],
});
const seat = (party, i, hero) => party.map((h, j) => (j === i ? hero : h));
export const experiments = {};
for (const [variant, patch] of [['built', undefined], ['swap', swap]]) {
  const rs = regions(variant === 'swap');
  for (const [name, party] of Object.entries(rs))
    for (const [other, theirs] of Object.entries(rs))
      if (other !== name)
        for (const [i, out] of party.entries())
          experiments[`${variant}-${theirs[i]}-for-${out}-${name}`] = {
            party,
            ...(patch ? {patch} : {}),
            mod: {party: seat(party, i, theirs[i])},
          };
}
const novice = {depth: 1, work: 220};
const expert = {depth: 4, work: 4 * 220};
for (const [level, search] of [['novice', novice], ['expert', expert]]) {
  const one = (name, i, hero, patch) =>
    (experiments[`${name}-${level}`] = {
      party: seat(steppe, i, hero),
      ...(patch ? {patch} : {}),
      mod: {search, searchHeroes: [hero]},
    });
  one('skill-swap-varangian-tank', 0, 'varangian', swap);
  one('skill-swap-cataphract-damage', 1, 'cataphract', swap);
  one('skill-built-varangian-damage', 1, 'varangian');
  one('skill-built-cataphract-tank', 0, 'cataphract');
  for (const hero of ['mangudai', 'youxia', 'archer']) one(`skill-built-${hero}-damage`, 1, hero);
  experiments[`skill-swap-byzantium-party-${level}`] = {
    party: ['varangian', 'cataphract', 'priest'],
    patch: swap,
    mod: {search},
  };
  experiments[`skill-built-byzantium-party-${level}`] = {
    party: ['cataphract', 'varangian', 'priest'],
    mod: {search},
  };
}
