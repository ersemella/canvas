// Whether a party needs one hero of each role to get through a run
// (roster.md: tank, damage, support): every party of three from the
// roster, grouped by shape. The 1/1/1 parties' spread is how much the
// choice of heroes moves a run's odds on its own; a missing role only
// matters if its group falls clearly below that spread. `runWinPct` is
// the measure, with each stage's losses by how they ended (a missing tank
// should show as the camel killed, a missing damage hero as stalls).
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
// Each role has two heroes, so a party of three misses at most one role.
const shape = (party) => {
  const missing = Object.keys(ROLES).find((r) => !party.some((h) => roleOf[h] === r));
  return missing ? `no-${missing}` : 'one-of-each';
};
export const experiments = Object.fromEntries(
  triples.map((party) => [party.join('+'), {party, group: shape(party)}])
);
