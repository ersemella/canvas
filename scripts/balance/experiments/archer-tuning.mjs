// The Archer's tuning (2026-10-27): at power 3 it won 56–67% in every seat
// (archer.mjs). Each variant, the Archer in the Horse Archer's seat of a
// Steppe mirror and the Swordsman's of a China mirror, as damage heroes.
const steppe = ['bokh', 'mangudai', 'storm'];
const china = ['youxia', 'modao', 'alchemist'];
const seat = (party, i, hero) => party.map((h, j) => (j === i ? hero : h));
const variants = {
  built: () => {},
  power2: (c) => {
    c.HEROES.archer.power = 2;
  },
  range4: (c) => {
    c.ABILITY.longshot.range = 4;
  },
  speed1: (c) => {
    c.HEROES.archer.speed = 1;
  },
  defence0: (c) => {
    c.HEROES.archer.defence = 0;
  },
};
export const experiments = {};
for (const [v, patch] of Object.entries(variants))
  for (const [name, party, i] of [
    ['steppe', steppe, 1],
    ['china', china, 0],
  ])
    experiments[`${v}-${name}`] = {
      party,
      // Measured with Longshot as first built: any unit on its lines, past
      // everything, no Pierce or Delay.
      patch: (c) => {
        Object.assign(c.ABILITY.longshot, {first: false, pierce: false, delay: 0});
        patch(c);
      },
      mod: {party: seat(party, i, 'archer')},
    };
