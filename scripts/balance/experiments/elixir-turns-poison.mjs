// The Alchemist's Elixir in lines, by turns or as poison (the owner,
// 2026-10-31): aimed as Axe Throw, a unit within 3 on one of its six lines,
// over anything (`ABILITY.elixir.line`, range 3); then either its casts
// taking turns, a heal of its power on an ally, then a hit of its power on
// an enemy (`mode` `alternate`), or any unit healed its power and then
// losing 1 every 6 slots until its power + 1 is lost (`mode` `poison`); no
// Empower or Weaken in either. Against the Elixir as built, and the lines
// alone with the built effects (`lineOnly`). The Alchemist in the other
// supports' seats and each of them in his own, as the Priest's seats were
// measured (priest-line.mjs). `modWinPct` throughout.
const regions = {
  steppe: ['bokh', 'mangudai', 'storm'],
  persia: ['mahout', 'archer', 'magus'],
  byzantium: ['cataphract', 'varangian', 'priest'],
};
const china = ['modao', 'youxia', 'alchemist'];
const seat = (party, i, hero) => party.map((h, j) => (j === i ? hero : h));
const lines = {range: 3, line: true};
const variants = {
  built: () => {},
  lineOnly: (c) => Object.assign(c.ABILITY.elixir, lines),
  turns: (c) => Object.assign(c.ABILITY.elixir, lines, {mode: 'alternate'}),
  poison: (c) => Object.assign(c.ABILITY.elixir, lines, {mode: 'poison'}),
  // The owner's question (2026-10-31): both with the Alchemist's power 2.
  turns2: (c) => {
    Object.assign(c.ABILITY.elixir, lines, {mode: 'alternate'});
    c.HEROES.alchemist.power = 2;
  },
  poison2: (c) => {
    Object.assign(c.ABILITY.elixir, lines, {mode: 'poison'});
    c.HEROES.alchemist.power = 2;
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
