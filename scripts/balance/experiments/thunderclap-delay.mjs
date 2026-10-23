// Thunderclap with a smaller Delay (owner, 2026-10-23): 2 and 1 slots,
// against the 3 measured in storm-second.mjs. Thunderclap next to Hail on
// both sides; each ability's worth, and the caravans with a Storm Caller.
const caravans = {
  'storm+2wolves': ['storm', 'wolf', 'wolf'],
  'bokh+storm+wolf': ['bokh', 'storm', 'wolf'],
  'mangudai+storm+wolf': ['mangudai', 'storm', 'wolf'],
  'storm+storm+wolf': ['storm', 'storm', 'wolf'],
  'all-three': ['bokh', 'mangudai', 'storm'],
};
const variant = (delay) => (c) => {
  c.HEROES.storm.abilities = ['hail', 'thunderclap', 'hold'];
  c.ABILITY.thunderclap.delay = delay;
};
export const experiments = Object.fromEntries(
  [2, 1].flatMap((delay) => {
    const patch = variant(delay);
    const name = `delay${delay}`;
    return [
      [`${name}:control`, {patch, mod: {}}],
      [`${name}:no-thunderclap`, {patch, mod: {ban: ['thunderclap']}}],
      [`${name}:no-hail`, {patch, mod: {ban: ['hail']}}],
      ...Object.entries(caravans).map(([c, enemies]) => [`${name}:vs-${c}`, {patch, enemies}]),
    ];
  })
);
