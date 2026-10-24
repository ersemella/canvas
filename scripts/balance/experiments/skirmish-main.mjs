// Skirmish as the Outrider's main attack (2026-10-24): in place of the Bow,
// instant (charge 0), the step optional (it may shoot from where it
// stands), at ranges unlimited, 5, 4 and 3; against today's kit (the Bow
// and Hold) as `today`. Each ability removed from one side, and the
// caravans that bring an Outrider (player wins).
const variants = {
  today: null,
  'range-inf': Infinity,
  'range-5': 5,
  'range-4': 4,
  'range-3': 3,
};
const caravans = {
  'mangudai+2wolves': ['mangudai', 'wolf', 'wolf'],
  'bokh+mangudai+wolf': ['bokh', 'mangudai', 'wolf'],
  'mangudai+storm+wolf': ['mangudai', 'storm', 'wolf'],
  'mangudai+mangudai+wolf': ['mangudai', 'mangudai', 'wolf'],
  'all-three': ['bokh', 'mangudai', 'storm'],
};
export const experiments = Object.fromEntries(
  Object.entries(variants).flatMap(([name, range]) => {
    const attack = range === null ? 'longshot' : 'skirmish';
    const patch = (c) => {
      if (range === null) return;
      c.HEROES.mangudai.abilities = ['skirmish', 'hold'];
      Object.assign(c.ABILITY.skirmish, {charge: 0, stay: true, range});
    };
    const bans = [[attack], ['hail'], ['grapple'], ['throw']];
    return [
      [`${name}:control`, {patch, mod: {}}],
      ...bans.map((ban) => [`${name}:no-${ban.join('-')}`, {patch, mod: {ban}}]),
      ...Object.entries(caravans).map(([c, enemies]) => [`${name}:vs-${c}`, {patch, enemies}]),
    ];
  })
);
