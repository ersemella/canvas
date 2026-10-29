// Omen's enemy Delayed a fixed amount (2026-10-29): in place of put just after
// the Magus's next turn, which can hold the same enemy back each turn for good,
// the enemy Delayed `ABILITY.omen.enemyDelay` slots, under his action cost (9)
// so it can't. In the support seat of a Steppe and a China mirror, as omen.mjs;
// and skill, the Magus played a decision deep or four deep in a Steppe mirror
// with a Magus on each side.
const steppe = ['bokh', 'mangudai', 'storm'];
const china = ['youxia', 'modao', 'alchemist'];
const seat = (party, i, hero) => party.map((h, j) => (j === i ? hero : h));
const novice = {depth: 1, work: 220};
const expert = {depth: 4, work: 4 * 220};
const at = (enemyDelay) => (c) => Object.assign(c.ABILITY.omen, {mode: 'single', range: 3, rider: 0, enemyDelay});
const variants = {after: at(0), delay3: at(3), delay4: at(4), delay6: at(6), delay8: at(8)};
export const experiments = {};
for (const [v, patch] of Object.entries(variants)) {
  for (const [name, party] of [
    ['steppe', steppe],
    ['china', china],
  ])
    experiments[`magus-${v}-${name}`] = {party, patch, mod: {party: seat(party, 2, 'magus')}};
  for (const [level, search] of [
    ['novice', novice],
    ['expert', expert],
  ])
    experiments[`${level}-magus-${v}`] = {
      party: seat(steppe, 2, 'magus'),
      patch,
      mod: {search, searchHeroes: ['magus']},
    };
}
