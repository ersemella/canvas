// Every duration in slots and Grapple off the track for every fight
// (2026-10-29, e21e411), against the rules just before (20cdc90): the four
// regions' parties against each other, 400 fights each.
const regions = {
  steppe: ['bokh', 'mangudai', 'storm'],
  china: ['modao', 'youxia', 'alchemist'],
  persia: ['mahout', 'archer', 'magus'],
  byzantium: ['cataphract', 'varangian', 'priest'],
};
export const experiments = {};
const names = Object.keys(regions);
for (const [i, a] of names.entries())
  for (const b of names.slice(i + 1))
    experiments[`${b}-vs-${a}`] = {party: regions[a], mod: {party: regions[b]}};
