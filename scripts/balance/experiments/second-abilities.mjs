// Second abilities measured (owner, 2026-10-24; balance.md): each new
// ability joins its hero's starting kit (no upgrades) on both sides, and
// one side goes without it: a second ability's worth is 40–50% (principle
// 2). Skirmish and Sunlight, the first upgrades, are measured the same way
// for reference. Gale, Volley, Feigned Retreat, Haul and Shove were made
// upgrades; the changed abilities measured beside them (Hold Loose, Hip
// Toss, Squall Line) and Tailwind and Overwatch were removed with their
// code (history.md), and their experiments with them.
const BASE = {
  bokh: ['grapple', 'throw', 'hold'],
  mangudai: ['snapShot', 'hold'],
  storm: ['hail', 'hold'],
};
/** `hero`'s starting kit with `ability` before Hold, on both sides. */
const plus = (hero, ability) => (c) => {
  c.HEROES[hero].abilities = [...BASE[hero].slice(0, -1), ability, 'hold'];
};
const added = {
  shove: 'bokh',
  haul: 'bokh',
  feignedRetreat: 'mangudai',
  volley: 'mangudai',
  gale: 'storm',
  skirmish: 'mangudai',
  sunlight: 'storm',
};

export const experiments = {
  control: {mod: {}},
  'no-grapple': {mod: {ban: ['grapple']}},
  'no-throw': {mod: {ban: ['throw']}},
  'no-hail': {mod: {ban: ['hail']}},
  ...Object.fromEntries(
    Object.entries(added).map(([ability, hero]) => [
      `no-${ability}`,
      {patch: plus(hero, ability), mod: {ban: [ability]}},
    ])
  ),
};
