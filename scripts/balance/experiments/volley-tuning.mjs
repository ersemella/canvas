// Volley variants (2026-10-23): range 2; 1 less damage; and a range of 2 to
// 3, so not on adjacent units. Each measured by removing Volley, or the
// Bow, from one side with the variant on both, and against the stage
// caravans that bring an Horse Archer (player wins; caravans.mjs for the rest).
const variants = {
  range2: (c) => (c.ABILITY.volley.range = 2),
  less1: (c) => (c.ABILITY.volley.less = 1),
  min2: (c) => (c.ABILITY.volley.minRange = 2),
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
    ...Object.entries(caravans).map(([c, enemies]) => [`${name}:vs-${c}`, {patch, enemies}]),
  ])
);
