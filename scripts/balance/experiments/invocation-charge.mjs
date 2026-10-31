// Invocation's charge (the owner's question, 2026-10-31): how long the
// Priest's card is out before it lands (`ABILITY.invocation.charge`, a
// share of his action cost), Wait off. At speed 1 his turn is 10 slots:
// built a Hold's cost, 10 (`c10-`), then 7, 5, 3 and 1 (`c7-` …), on the same
// seeds. Rows as priest-invocation.mjs: his support seats (others' and
// kept, the score their mean), and the skill of the Priest (novice depth
// 1, expert depth 4 with 4x work, in the Steppe's support seat) and of
// Byzantium's party, against production's search. `modWinPct` throughout.
const regions = {
  steppe: ['bokh', 'mangudai', 'storm'],
  china: ['modao', 'youxia', 'alchemist'],
  persia: ['mahout', 'archer', 'magus'],
};
const byzantium = ['cataphract', 'varangian', 'priest'];
const seat = (party, i, hero) => party.map((h, j) => (j === i ? hero : h));
// 6 (`c6-`, 0.6) built since later 2026-10-31; `c10-` (null) a Hold's cost.
const charges = {c10: null, c7: 0.7, c6: 0.6, c5: 0.5, c3: 0.3, c1: 0.1};
const novice = {depth: 1, work: 220};
const expert = {depth: 4, work: 4 * 220};
export const experiments = {};
for (const [v, charge] of Object.entries(charges)) {
  const patch = (c) => {
    c.ABILITY.invocation.charge = charge;
  };
  for (const [name, party] of Object.entries(regions)) {
    experiments[`${v}-priest-for-${party[2]}-${name}`] = {
      party,
      patch,
      mod: {party: seat(party, 2, 'priest')},
    };
    experiments[`${v}-${party[2]}-for-priest-byzantium`] = {
      party: byzantium,
      patch,
      mod: {party: seat(byzantium, 2, party[2])},
    };
  }
  for (const [level, search] of [
    ['novice', novice],
    ['expert', expert],
  ]) {
    experiments[`${v}-skill-priest-${level}`] = {
      party: seat(regions.steppe, 2, 'priest'),
      patch,
      mod: {search, searchHeroes: ['priest']},
    };
    experiments[`${v}-skill-byzantium-party-${level}`] = {party: byzantium, patch, mod: {search}};
  }
}
