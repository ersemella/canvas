// Invocation, the Priest's in place of Blessing (owner, 2026-10-31): speed
// 1, defence 2, power 3; a space within 3 and the spaces next to it,
// charged a Hold's cost, enemies there hit and allies healed his power (an
// Empower adding to both) when his card comes back, then a full turn on.
//
// Roles, as priest-line-any.mjs: the Priest in the support seat of a
// Steppe, a China and a Persia mirror (others'), and each of their supports
// in his seat of Byzantium's (kept); the score their mean. Variants on the
// same seeds: as built (`invocation-`); the Priest as he was, speed 2,
// defence 1, Blessing in a line (`blessing-`); and Invocation with Wait at
// 2/3 for both sides, as the test stage plays it (`wait-`).
// Skill, as skill-fights.mjs: the Priest played by a novice (depth 1) or an
// expert (depth 4, 4x work) in the Steppe's support seat, and Byzantium's
// party, against production's search. `modWinPct` throughout.
const regions = {
  steppe: ['bokh', 'mangudai', 'storm'],
  china: ['modao', 'youxia', 'alchemist'],
  persia: ['mahout', 'archer', 'magus'],
};
const byzantium = ['cataphract', 'varangian', 'priest'];
const seat = (party, i, hero) => party.map((h, j) => (j === i ? hero : h));
const variants = {
  invocation: undefined,
  blessing: (c) => {
    Object.assign(c.HEROES.priest, {speed: 2, defence: 1, abilities: ['blessing', 'hold']});
  },
  wait: (c) => {
    c.RULES.waitShare = 2 / 3;
  },
};
const novice = {depth: 1, work: 220};
const expert = {depth: 4, work: 4 * 220};
export const experiments = {};
for (const [v, patch] of Object.entries(variants)) {
  const p = patch ? {patch} : {};
  for (const [name, party] of Object.entries(regions)) {
    experiments[`${v}-priest-for-${party[2]}-${name}`] = {
      party,
      ...p,
      mod: {party: seat(party, 2, 'priest')},
    };
    experiments[`${v}-${party[2]}-for-priest-byzantium`] = {
      party: byzantium,
      ...p,
      mod: {party: seat(byzantium, 2, party[2])},
    };
  }
  for (const [level, search] of [
    ['novice', novice],
    ['expert', expert],
  ]) {
    experiments[`${v}-skill-priest-${level}`] = {
      party: seat(regions.steppe, 2, 'priest'),
      ...p,
      mod: {search, searchHeroes: ['priest']},
    };
    experiments[`${v}-skill-byzantium-party-${level}`] = {party: byzantium, ...p, mod: {search}};
  }
}
