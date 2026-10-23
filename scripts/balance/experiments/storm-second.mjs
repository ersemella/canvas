// The Storm Caller's second ability (proposed, 2026-10-23): Gale,
// Thunderclap or Rain-stone Ward next to Hail, one at a time, against
// Hail alone. Each variant puts its ability in the kit on both sides; its
// worth is the win rate of a side without it, and the stage caravans that
// bring a Storm Caller show what it does to difficulty (player wins).
const kit = (id) => (c) =>
  (c.HEROES.storm.abilities = id ? ['hail', id, 'hold'] : ['hail', 'hold']);
const variants = {hail: null, gale: 'gale', thunderclap: 'thunderclap', ward: 'ward'};
const caravans = {
  'storm+2wolves': ['storm', 'wolf', 'wolf'],
  'bokh+storm+wolf': ['bokh', 'storm', 'wolf'],
  'mangudai+storm+wolf': ['mangudai', 'storm', 'wolf'],
  'storm+storm+wolf': ['storm', 'storm', 'wolf'],
  'all-three': ['bokh', 'mangudai', 'storm'],
};
export const experiments = Object.fromEntries(
  Object.entries(variants).flatMap(([name, id]) => {
    const patch = kit(id);
    return [
      [`${name}:control`, {patch, mod: {}}],
      ...(id ? [[`${name}:no-${id}`, {patch, mod: {ban: [id]}}]] : []),
      [`${name}:no-hail`, {patch, mod: {ban: ['hail']}}],
      ...Object.entries(caravans).map(([c, enemies]) => [`${name}:vs-${c}`, {patch, enemies}]),
    ];
  })
);
