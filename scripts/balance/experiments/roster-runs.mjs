// Whole runs on the rules of 2026-10-27 (roles.mjs's question again, and
// skill): every party of three from the six built heroes, played by
// production's AI; and the one-of-each parties played by a novice (one
// decision ahead) and an expert (mirror.ts's `deep`), the enemy always
// production's. A hero strictly better to have would lift every party it
// joins; skill expression is how far a party's runs move between the two.
const ROLES = {
  tank: ['bokh', 'modao'],
  damage: ['mangudai', 'youxia'],
  support: ['storm', 'alchemist'],
};
const roleOf = Object.fromEntries(
  Object.entries(ROLES).flatMap(([role, heroes]) => heroes.map((h) => [h, role]))
);
const heroes = Object.values(ROLES).flat();
const triples = heroes.flatMap((a, i) =>
  heroes.slice(i + 1).flatMap((b, j) => heroes.slice(i + j + 2).map((c) => [a, b, c]))
);
const shape = (party) => {
  const missing = Object.keys(ROLES).find((r) => !party.some((h) => roleOf[h] === r));
  return missing ? `no-${missing}` : 'one-of-each';
};
const novice = {depth: 1, work: 220};
const expert = {depth: 4, work: 4 * 220};
export const experiments = Object.fromEntries(
  triples.map((party) => [party.join('+'), {party, group: shape(party)}])
);
for (const party of triples.filter((p) => shape(p) === 'one-of-each'))
  for (const [level, search] of [['novice', novice], ['expert', expert]])
    experiments[`${level}:${party.join('+')}`] = {party, search, group: level};
