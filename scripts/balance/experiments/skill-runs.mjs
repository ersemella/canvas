// Whole runs on current main (three regions, bosses, the road sealed while a
// boss stands): each region's party played by a novice (depth 1),
// production (depth 3) and an expert (depth 4, 4x work), the enemy always
// production's.
const regions = {
  steppe: ['bokh', 'mangudai', 'storm'],
  china: ['modao', 'youxia', 'alchemist'],
  persia: ['mahout', 'archer', 'magus'],
  byzantium: ['cataphract', 'varangian', 'priest'],
};
const levels = {novice: {depth: 1, work: 220}, production: undefined, expert: {depth: 4, work: 4 * 220}};
export const experiments = {};
for (const [name, party] of Object.entries(regions))
  for (const [level, search] of Object.entries(levels))
    experiments[`${level}:${name}`] = {party, group: level, ...(search ? {search} : {})};
