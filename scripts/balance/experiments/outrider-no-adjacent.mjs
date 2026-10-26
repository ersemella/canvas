// The Horse Archer unable to strike an adjacent unit with the Bow or Volley
// (owner's question, 2026-10-23): an adjacent unit still stops the Bow's
// arrow. With Volley at range 3 (as proposed) and at range 2. Each
// measured by removing Volley or the Bow from one side, and against the
// stage caravans that bring an Horse Archer.
const noAdjacent = (c) => {
  c.ABILITY.bow.minRange = 2;
  c.ABILITY.volley.minRange = 2;
};
const variants = {
  'r3-noadj': noAdjacent,
  'r2-noadj': (c) => {
    noAdjacent(c);
    c.ABILITY.volley.range = 2;
  },
};
const caravans = {
  'mangudai+2wolves': ['mangudai', 'wolf', 'wolf'],
  'bokh+mangudai+wolf': ['bokh', 'mangudai', 'wolf'],
  'mangudai+mangudai+wolf': ['mangudai', 'mangudai', 'wolf'],
  'all-three': ['bokh', 'mangudai', 'storm'],
};
export const experiments = Object.fromEntries(
  Object.entries(variants).flatMap(([name, patch]) => [
    [`${name}:control`, {patch, mod: {}}],
    [`${name}:no-volley`, {patch, mod: {ban: ['volley']}}],
    [`${name}:no-bow`, {patch, mod: {ban: ['bow']}}],
    [`${name}:no-grapple`, {patch, mod: {ban: ['grapple']}}],
    ...Object.entries(caravans).map(([c, enemies]) => [`${name}:vs-${c}`, {patch, enemies}]),
  ])
);
