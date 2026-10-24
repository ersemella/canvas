// Second abilities measured (owner, 2026-10-24; balance.md): new abilities
// and changed ones, on today's starting kits (no upgrades).
//
// A new ability joins its hero's kit on both sides, and one side goes
// without it: a second ability's worth is 40–50% (principle 2). Skirmish
// and Sunlight, today's upgrades, are measured the same way for reference.
//
// A changed ability replaces the original on one side only (`mod.kits`):
// head to head, above 50% means the change is a buff. Then both sides have
// it and one side goes without, for its worth beside the original's.
const BASE = {
  bokh: ['grapple', 'throw', 'hold'],
  mangudai: ['longshot', 'hold'],
  storm: ['hail', 'hold'],
};
const withKits = (kits) => (c) => {
  for (const [hero, kit] of Object.entries(kits)) c.HEROES[hero].abilities = kit;
};
/** `hero`'s starting kit with `ability` before Hold. */
const plus = (hero, ability) => ({[hero]: [...BASE[hero].slice(0, -1), ability, 'hold']});

const added = {
  shove: 'bokh',
  haul: 'bokh',
  feignedRetreat: 'mangudai',
  volley: 'mangudai',
  overwatch: 'mangudai',
  gale: 'storm',
  tailwind: 'storm',
  skirmish: 'mangudai',
  sunlight: 'storm',
};
const changed = {
  holdLoose: {hero: 'bokh', kit: ['holdLoose', 'throw', 'hold'], original: 'grapple'},
  hipToss: {hero: 'bokh', kit: ['grapple', 'hipToss', 'hold'], original: 'throw'},
  squall: {hero: 'storm', kit: ['squall', 'hold'], original: 'hail'},
};

export const experiments = {
  control: {mod: {}},
  'no-grapple': {mod: {ban: ['grapple']}},
  'no-throw': {mod: {ban: ['throw']}},
  'no-hail': {mod: {ban: ['hail']}},
  ...Object.fromEntries(
    Object.entries(added).map(([ability, hero]) => [
      `no-${ability}`,
      {patch: withKits(plus(hero, ability)), mod: {ban: [ability]}},
    ])
  ),
  ...Object.fromEntries(
    Object.entries(changed).flatMap(([ability, {hero, kit, original}]) => [
      [`${ability}-vs-${original}`, {mod: {kits: {[hero]: kit}}}],
      [`no-${ability}`, {patch: withKits({[hero]: kit}), mod: {ban: [ability]}}],
    ])
  ),
  // How much Overwatch leans on the AI's value for a lane (AI.watchShare, 0.25).
  ...Object.fromEntries(
    [0.1, 0.5].map((share) => [
      `no-overwatch:watch-${share}`,
      {
        patch: (c) => {
          withKits(plus('mangudai', 'overwatch'))(c);
          c.AI.watchShare = share;
        },
        mod: {ban: ['overwatch']},
      },
    ])
  ),
};
