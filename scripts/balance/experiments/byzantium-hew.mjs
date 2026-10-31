// After byzantium-swap.mjs (owner, later 2026-10-31): the swap with the
// Barbarian's Hew in place of Leap (a funnel, two spaces next to him and
// the one past them, Empowered 1 an enemy hit for 10 slots, `ABILITY.hew`),
// the Cataphract as there (`hew`), and with Armoured back (`hewArmoured`).
// Only the rows of roles-twelve.mjs with Byzantium in them (the rest
// unchanged, in byzantium-swap.mjs's `swap-` rows), and the skill of the two
// changed heroes in their seats, as skill-fights.mjs. `modWinPct`.
const swap = (armoured) => (c) => {
  Object.assign(c.HEROES.varangian, {speed: 1, defence: 3, power: 2, abilities: ['hew', 'hold']});
  Object.assign(c.HEROES.cataphract, {speed: 2, defence: 2, power: 2, passives: armoured ? ['armoured'] : []});
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
for (const [variant, patch] of [['hew', swap(false)], ['hewArmoured', swap(true)]])
  for (const [name, party] of Object.entries(regions))
    for (const [other, theirs] of Object.entries(regions))
      if (other !== name && (name === 'byzantium' || other === 'byzantium'))
        for (const [i, out] of party.entries())
          experiments[`${variant}-${theirs[i]}-for-${out}-${name}`] = {
            party,
            patch,
            mod: {party: seat(party, i, theirs[i])},
          };
const novice = {depth: 1, work: 220};
const expert = {depth: 4, work: 4 * 220};
for (const [level, search] of [['novice', novice], ['expert', expert]]) {
  experiments[`skill-hew-varangian-tank-${level}`] = {
    party: seat(steppe, 0, 'varangian'),
    patch: swap(false),
    mod: {search, searchHeroes: ['varangian']},
  };
  experiments[`skill-hewArmoured-cataphract-damage-${level}`] = {
    party: seat(steppe, 1, 'cataphract'),
    patch: swap(true),
    mod: {search, searchHeroes: ['cataphract']},
  };
}
