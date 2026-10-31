// The Alchemist's Elixir as an overdose (the owner, 2026-10-31): its shape as
// built (one unit within 2, itself too), but on any unit, ally or enemy, an
// Empower up to a hit of `overdose` (6 one-shots every hero of defence 1 or
// 2, 4 those of defence 1) for a turn's slots (8), and a hit of the
// Alchemist's power on it (`ABILITY.elixir.overdose`); no heal, hit or
// Weaken besides; and the overdose in other shapes. Against the Elixir as built, in the seats of
// elixir-turns-poison.mjs. `modWinPct` throughout.
const regions = {
  steppe: ['bokh', 'mangudai', 'storm'],
  persia: ['mahout', 'archer', 'magus'],
  byzantium: ['cataphract', 'varangian', 'priest'],
};
const china = ['modao', 'youxia', 'alchemist'];
const seat = (party, i, hero) => party.map((h, j) => (j === i ? hero : h));
const variants = {
  built: () => {},
  overdose6: (c) => Object.assign(c.ABILITY.elixir, {overdose: 6}),
  overdose4: (c) => Object.assign(c.ABILITY.elixir, {overdose: 4}),
  overdose6p2: (c) => {
    Object.assign(c.ABILITY.elixir, {overdose: 6});
    c.HEROES.alchemist.power = 2;
  },
  // Its shape (the owner's question, 2026-10-31), the overdose to 6 at power 1:
  // in lines to 3 as Axe Throw (the test stage's), one unit within 3, a burst
  // of radius 1 on a space within 2, every unit next to him and himself.
  odLine: (c) => Object.assign(c.ABILITY.elixir, {overdose: 6, line: true, range: 3}),
  odRange3: (c) => Object.assign(c.ABILITY.elixir, {overdose: 6, range: 3}),
  odBurst: (c) => Object.assign(c.ABILITY.elixir, {overdose: 6, shape: 'burst', radius: 1}),
  odAura: (c) => Object.assign(c.ABILITY.elixir, {overdose: 6, shape: 'aura', radius: 1}),
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
