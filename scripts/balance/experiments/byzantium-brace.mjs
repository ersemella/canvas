// The swap as the test stage has it (owner, later 2026-10-31): the
// Barbarian a tank with Hew, Shield 1 for each enemy hit for 10 slots
// (`ABILITY.hew.shieldPerHit`, in place of its Empower); the Cataphract the
// damage hero without Armoured, Armour 1 for 8 slots after each charge
// (`ABILITY.charge.armour`). Every row of roles-twelve.mjs on today's rules
// (the Elixir an overdose, in runs since `83f760a`), Byzantium's party
// ordered tank, damage, support; and the two heroes' skill in their seats,
// as skill-fights.mjs. `modWinPct`.
const brace = (c) => {
  Object.assign(c.HEROES.varangian, {speed: 1, defence: 3, power: 2, abilities: ['hew', 'hold']});
  Object.assign(c.HEROES.cataphract, {speed: 2, defence: 2, power: 2, passives: []});
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
for (const [name, party] of Object.entries(regions))
  for (const [other, theirs] of Object.entries(regions))
    if (other !== name)
      for (const [i, out] of party.entries())
        experiments[`brace-${theirs[i]}-for-${out}-${name}`] = {party, patch: brace, mod: {party: seat(party, i, theirs[i])}};
const novice = {depth: 1, work: 220};
const expert = {depth: 4, work: 4 * 220};
for (const [level, search] of [['novice', novice], ['expert', expert]]) {
  experiments[`skill-varangian-tank-${level}`] = {party: seat(steppe, 0, 'varangian'), patch: brace, mod: {search, searchHeroes: ['varangian']}};
  experiments[`skill-cataphract-damage-${level}`] = {party: seat(steppe, 1, 'cataphract'), patch: brace, mod: {search, searchHeroes: ['cataphract']}};
}
