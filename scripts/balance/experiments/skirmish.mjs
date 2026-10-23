// Skirmish in place of Volley (owner's question, 2026-10-23): the
// Outrider steps one space, then shoots as the Bow does. The Bow stays, so
// the step is optional. `step`: the shot at once; `step-charged`: the
// arrow flies when the charging card comes back (half the action cost, as
// Volley's), down the lane it was aimed along, hitting the first unit in it
// then. `today` is the kit as shipped (Bow and a charged Volley). Each
// ability removed from one side, and the caravans that bring an Outrider.
const variants = {
  today: {kit: ['bow', 'volley', 'hold'], charge: 0, second: 'volley'},
  step: {kit: ['bow', 'skirmish', 'hold'], charge: 0, second: 'skirmish'},
  'step-charged': {kit: ['bow', 'skirmish', 'hold'], charge: 0.5, second: 'skirmish'},
  'step-charged-full': {kit: ['bow', 'skirmish', 'hold'], charge: 1, second: 'skirmish'},
};
const caravans = {
  'mangudai+2wolves': ['mangudai', 'wolf', 'wolf'],
  'bokh+mangudai+wolf': ['bokh', 'mangudai', 'wolf'],
  'mangudai+storm+wolf': ['mangudai', 'storm', 'wolf'],
  'mangudai+mangudai+wolf': ['mangudai', 'mangudai', 'wolf'],
  'all-three': ['bokh', 'mangudai', 'storm'],
};
export const experiments = Object.fromEntries(
  Object.entries(variants).flatMap(([name, {kit, charge, second}]) => {
    const patch = (c) => {
      c.HEROES.mangudai.abilities = [...kit];
      c.ABILITY.skirmish.charge = charge;
    };
    const bans = [['bow'], [second], ['hail'], ['sunlight'], ['grapple'], ['throw'], ['bow', second]];
    return [
      [`${name}:control`, {patch, mod: {}}],
      ...bans.map((ban) => [`${name}:no-${ban.join('-')}`, {patch, mod: {ban}}]),
      ...Object.entries(caravans).map(([c, enemies]) => [`${name}:vs-${c}`, {patch, enemies}]),
    ];
  })
);
