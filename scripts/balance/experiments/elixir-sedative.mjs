// The Alchemist with a choice (the owner, 2026-10-31): the overdose as built
// (a unit within 3 Empowered to hit for 6, hit for his power), or Sedative
// (`ABILITY.sedative`), a unit within 3, ally or enemy, healed his power and
// Weakened by all it deals, so its hits deal nothing for 8 slots; both in
// his kit. Against the overdose alone, in the seats of elixir-overdose.mjs.
const regions = {
  steppe: ['bokh', 'mangudai', 'storm'],
  persia: ['mahout', 'archer', 'magus'],
  byzantium: ['cataphract', 'varangian', 'priest'],
};
const china = ['modao', 'youxia', 'alchemist'];
const seat = (party, i, hero) => party.map((h, j) => (j === i ? hero : h));
const variants = {
  built: () => {},
  sedative: (c) => {
    c.HEROES.alchemist.abilities = ['elixir', 'sedative', 'hold'];
  },
};
const novice = {depth: 1, work: 220};
const expert = {depth: 4, work: 4 * 220};
export const experiments = {};
for (const [v, patch] of Object.entries(variants)) {
  for (const [name, party] of Object.entries(regions)) {
    experiments[`${v}-alchemist-for-${party[2]}-${name}`] = {
      party,
      patch,
      mod: {party: seat(party, 2, 'alchemist')},
    };
    experiments[`${v}-${party[2]}-for-alchemist-china`] = {
      party: china,
      patch,
      mod: {party: seat(china, 2, party[2])},
    };
  }
  for (const [level, search] of [
    ['novice', novice],
    ['expert', expert],
  ])
    experiments[`${v}-${level}-alchemist`] = {
      party: seat(regions.steppe, 2, 'alchemist'),
      patch,
      mod: {search, searchHeroes: ['alchemist']},
    };
}
