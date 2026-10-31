// The Vanguard's skill (2026-10-31) by the options of
// cleave-for-spearhead.mjs, as skill-fights.mjs measures it: a novice
// (depth 1) or an expert (depth 4, 4x work) in the tank seat of a Steppe
// mirror. Spearhead at range 2 as built at Cleave's Delay 6 (`spearhead-d6`),
// or none at Delay 6 or 7; the other tanks once, as built. `modWinPct`.
const steppe = ['bokh', 'mangudai', 'storm'];
const novice = {depth: 1, work: 220};
const expert = {depth: 4, work: 4 * 220};
const seat = (hero) => steppe.map((h, j) => (j === 0 ? hero : h));
const variants = {'spearhead-d6': [true, 6], 'none-d6': [false, 6], 'none-d7': [false, 7]};
export const experiments = {};
for (const [level, search] of [['novice', novice], ['expert', expert]]) {
  for (const [variant, [spearhead, delay]] of Object.entries(variants))
    experiments[`${variant}-${level}-modao`] = {
      party: seat('modao'),
      patch: (config) => {
        config.ABILITY.cleave.delay = delay;
        if (!spearhead) config.HEROES.modao.passives = [];
      },
      mod: {search, searchHeroes: ['modao']},
    };
  for (const hero of ['bokh', 'mahout', 'cataphract'])
    experiments[`${level}-${hero}`] = {party: seat(hero), mod: {search, searchHeroes: [hero]}};
}
