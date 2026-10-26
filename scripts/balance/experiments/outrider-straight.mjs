// The Horse Archer's straight move (owner, 2026-10-25; balance.md): any number of
// spaces along one of the six lanes, against the walk of 2 it replaced, with
// the starting kits. Each starting ability removed from one side, and the
// full party against all three heroes (player wins).
const walk2 = (c) => {
  c.HEROES.mangudai.movesStraight = false;
};
const rules = {straight: undefined, walk2};
const bans = [['longshot'], ['hail'], ['grapple']];
const heroes = ['bokh', 'mangudai', 'storm'];
export const experiments = Object.fromEntries(
  Object.entries(rules).flatMap(([name, patch]) => [
    [`${name}-control`, {patch, mod: {}}],
    ...bans.map((ban) => [`${name}-no-${ban.join('-')}`, {patch, mod: {ban}}]),
    [`${name}-vs-all-three`, {patch, enemies: heroes}],
  ])
);
