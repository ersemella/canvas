// Ways to even China against the Steppe after a Hastened or Delayed card
// won the collision where it lands (2026-10-26): Cleave's Delay, Swift
// Strike's Haste and the Elixir's Haste lower, or the Storm Caller faster.
// Each variant patches both sides; `party` is China for the Steppe, the
// others each Chinese hero in its role's Steppe seat (50% its equal).
const steppe = ['bokh', 'mangudai', 'storm'];
const china = ['youxia', 'modao', 'alchemist'];
const roles = {modao: 'bokh', youxia: 'mangudai', alchemist: 'storm'};
const variants = {
  'cleave-6': (c) => void (c.ABILITY.cleave.delay = 6),
  'cleave-5': (c) => void (c.ABILITY.cleave.delay = 5),
  'swift-2': (c) => void (c.ABILITY.swiftStrike.haste = 2),
  'elixir-haste-2': (c) => void (c.ABILITY.elixir.haste = 2),
  'storm-speed-3': (c) => void (c.HEROES.storm.speed = 3),
  // Speed 3 and defence 1 (health 4, from 6).
  'storm-speed-3-def-1': (c) => {
    c.HEROES.storm.speed = 3;
    c.HEROES.storm.defence = 1;
  },
};
export const experiments = {};
for (const [name, patch] of Object.entries(variants)) {
  experiments[`${name}-party`] = {patch, mod: {party: china}};
  for (const [hero, seat] of Object.entries(roles))
    experiments[`${name}-${hero}-for-${seat}`] = {
      patch,
      mod: {party: steppe.map((h) => (h === seat ? hero : h))},
    };
}
// Stage caravans with a Storm Caller against the Steppe party and camel
// (`playerWinPct`; lower, a stronger enemy), built and for each Storm Caller
// variant.
const caravans = {
  'storm+2wolves': ['storm', 'wolf', 'wolf'],
  'bokh+storm+wolf': ['bokh', 'storm', 'wolf'],
  'mangudai+storm+wolf': ['mangudai', 'storm', 'wolf'],
  'storm+storm+wolf': ['storm', 'storm', 'wolf'],
  'all-three': steppe,
};
for (const name of ['built', 'storm-speed-3', 'storm-speed-3-def-1'])
  for (const [caravan, enemies] of Object.entries(caravans))
    experiments[`${name}-vs-${caravan}`] = {patch: variants[name], enemies};
