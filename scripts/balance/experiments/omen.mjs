// Omen (2026-10-27): the Magus's ability on one unit within range, its side
// choosing the effect, as the Elixir's does: an ally acts next, an enemy just
// after the Magus's next turn, with no guard (`ABILITY.conjunction.mode:
// 'omen'`); at range 2 and 3, and with a rider, the ally Empowered 1 or the
// enemy Weakened 1 (`.rider`). In the support seat of a Steppe and a China
// mirror, as archer-magus.mjs; and skill, as roster-check.mjs, the Magus played
// a decision deep or four deep in a Steppe mirror with a Magus on each side,
// for Omen and for Conjunction as then built (the bracket, range 2).
const steppe = ['bokh', 'mangudai', 'storm'];
const china = ['youxia', 'modao', 'alchemist'];
const seat = (party, i, hero) => party.map((h, j) => (j === i ? hero : h));
const novice = {depth: 1, work: 220};
const expert = {depth: 4, work: 4 * 220};
const omen = (range, rider) => (c) =>
  Object.assign(c.ABILITY.conjunction, {mode: 'omen', range, rider});
const variants = {
  omen: omen(2, 0),
  'omen+range3': omen(3, 0),
  'omen+rider1': omen(2, 1),
  'omen+range3+rider1': omen(3, 1),
};
export const experiments = {};
for (const [v, patch] of Object.entries(variants))
  for (const [name, party] of [
    ['steppe', steppe],
    ['china', china],
  ])
    experiments[`magus-${v}-${name}`] = {party, patch, mod: {party: seat(party, 2, 'magus')}};
const party = seat(steppe, 2, 'magus');
for (const [v, patch] of [
  ['bracket', (c) => Object.assign(c.ABILITY.conjunction, {mode: 'bracket', range: 2})],
  ['omen', variants.omen],
  ['omen+range3', variants['omen+range3']],
])
  for (const [level, search] of [
    ['novice', novice],
    ['expert', expert],
  ])
    experiments[`${level}-magus-${v}`] = {party, patch, mod: {search, searchHeroes: ['magus']}};
