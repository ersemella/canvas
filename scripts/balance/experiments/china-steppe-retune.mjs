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
