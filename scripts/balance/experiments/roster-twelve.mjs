// A balance check of all twelve heroes on the rules of 2026-10-28 (the
// Byzantine three as built: the Cataphract's Charge, the Barbarian's Reave,
// the Priest's Blessing with a lasting Shield): each hero in every seat of
// the three other regions' mirrors, and each region's party against the
// others, as roster-nine.mjs measured the first nine. `modWinPct` throughout.
const regions = {
  steppe: ['bokh', 'mangudai', 'storm'],
  china: ['modao', 'youxia', 'alchemist'],
  persia: ['mahout', 'archer', 'magus'],
  byzantium: ['cataphract', 'varangian', 'priest'],
};
const heroes = Object.values(regions).flat();
const seat = (party, i, hero) => party.map((h, j) => (j === i ? hero : h));
export const experiments = {};
// Party against party, each pair once.
const names = Object.keys(regions);
for (const [i, a] of names.entries())
  for (const b of names.slice(i + 1))
    experiments[`${b}-vs-${a}`] = {party: regions[a], mod: {party: regions[b]}};
// Every hero in every seat of each other region's mirror.
for (const [name, party] of Object.entries(regions))
  for (const hero of heroes)
    for (const [i, out] of party.entries()) {
      if (party.includes(hero)) continue;
      experiments[`${hero}-for-${out}-${name}`] = {party, mod: {party: seat(party, i, hero)}};
    }
