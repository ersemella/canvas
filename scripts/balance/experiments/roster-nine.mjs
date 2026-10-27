// A balance check of all nine heroes on the rules of 2026-10-27 (the
// Magus, the Elephant Rider and the Archer as built, Longshot at any range):
// each hero in every seat of a Steppe, a China and a Persia mirror, each
// region's party against the others, and how much the Persian heroes reward
// being played well, as roster-check.mjs measured the first six. `modWinPct`
// throughout.
const steppe = ['bokh', 'mangudai', 'storm'];
const china = ['modao', 'youxia', 'alchemist'];
const persia = ['mahout', 'archer', 'magus'];
const heroes = [...steppe, ...china, ...persia];
const role = {
  bokh: 0,
  modao: 0,
  mahout: 0,
  mangudai: 1,
  youxia: 1,
  archer: 1,
  storm: 2,
  alchemist: 2,
  magus: 2,
};
// As roster-check.mjs: a novice looks one decision ahead, an expert as
// mirror.ts's `deep`.
const novice = {depth: 1, work: 220};
const expert = {depth: 4, work: 4 * 220};
const seat = (party, i, hero) => party.map((h, j) => (j === i ? hero : h));
const parties = [
  ['steppe', steppe],
  ['china', china],
  ['persia', persia],
];
export const experiments = {
  'china-vs-steppe': {party: steppe, mod: {party: china}},
  'persia-vs-steppe': {party: steppe, mod: {party: persia}},
  'persia-vs-china': {party: china, mod: {party: persia}},
};
// Every hero in every seat of each mirror; a party never holds two of a hero.
for (const [name, party] of parties)
  for (const hero of heroes)
    for (const [i, out] of party.entries()) {
      if (party.includes(hero)) continue;
      experiments[`${hero}-for-${out}-${name}`] = {party, mod: {party: seat(party, i, hero)}};
    }
// Skill for the Persian heroes, as roster-check.mjs measured the others.
for (const hero of persia) {
  const party = seat(steppe, role[hero], hero);
  for (const [level, search] of [
    ['novice', novice],
    ['expert', expert],
  ])
    experiments[`${level}-${hero}`] = {party, mod: {search, searchHeroes: [hero]}};
}
// Measured with Conjunction as a swap and Longshot as first built (any unit
// on its lines, no Pierce or Delay), both built until later that day.
for (const e of Object.values(experiments))
  e.patch = (c) => {
    c.ABILITY.conjunction.mode = 'swap';
    Object.assign(c.ABILITY.longshot, {first: false, pierce: false, delay: 0});
  };
