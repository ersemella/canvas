// Each of the twelve heroes in its role's seat (tank, damage, support) of
// the three other regions' mirrors, on the rules of 2026-10-29 (every
// duration in slots, Grapple off the track). Only the role seats of
// roster-twelve.mjs, and no party against party. `modWinPct` throughout.
const regions = {
  steppe: ['bokh', 'mangudai', 'storm'],
  china: ['modao', 'youxia', 'alchemist'],
  persia: ['mahout', 'archer', 'magus'],
  byzantium: ['cataphract', 'varangian', 'priest'],
};
const seat = (party, i, hero) => party.map((h, j) => (j === i ? hero : h));
export const experiments = {};
for (const [name, party] of Object.entries(regions))
  for (const [other, theirs] of Object.entries(regions))
    if (other !== name)
      for (const [i, out] of party.entries())
        experiments[`${theirs[i]}-for-${out}-${name}`] = {party, mod: {party: seat(party, i, theirs[i])}};
