// Skirmish in place of Volley (owner, 2026-10-23): the Outrider steps one
// space, then shoots as the Bow does, charged half its action cost (as
// adopted). Volley, measured beside it as `today`, was removed with its
// code once Skirmish was adopted; the measurements are in balance.md. Each
// charge with each ability removed from one side, and the caravans that
// bring an Outrider (player wins).
const charges = {'step-charged': 0.5, step: 0, 'step-charged-full': 1};
const caravans = {
  'mangudai+2wolves': ['mangudai', 'wolf', 'wolf'],
  'bokh+mangudai+wolf': ['bokh', 'mangudai', 'wolf'],
  'mangudai+storm+wolf': ['mangudai', 'storm', 'wolf'],
  'mangudai+mangudai+wolf': ['mangudai', 'mangudai', 'wolf'],
  'all-three': ['bokh', 'mangudai', 'storm'],
};
const bans = [
  ['bow'],
  ['skirmish'],
  ['hail'],
  ['sunlight'],
  ['grapple'],
  ['throw'],
  ['bow', 'skirmish'],
];
export const experiments = Object.fromEntries(
  Object.entries(charges).flatMap(([name, charge]) => {
    const patch = (c) => {
      c.ABILITY.skirmish.charge = charge;
    };
    return [
      [`${name}:control`, {patch, mod: {}}],
      ...bans.map((ban) => [`${name}:no-${ban.join('-')}`, {patch, mod: {ban}}]),
      ...Object.entries(caravans).map(([c, enemies]) => [`${name}:vs-${c}`, {patch, enemies}]),
    ];
  })
);
