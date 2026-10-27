// Archer nerfs other than Longshot's range, and Magus buffs (2026-10-27): at
// built the Archer won 58–67% in every seat, the Magus 22–36% (roster-nine.mjs).
// Each variant, the Archer in the damage seat and the Magus in the support
// seat of a Steppe mirror and a China mirror. `modWinPct`; 50% is the hero's
// equal there.
const steppe = ['bokh', 'mangudai', 'storm'];
const china = ['youxia', 'modao', 'alchemist'];
const seat = (party, i, hero) => party.map((h, j) => (j === i ? hero : h));
const archer = {
  built: () => {},
  // No shot at the spaces next to it.
  minRange2: (c) => {
    c.ABILITY.longshot.minRange = 2;
  },
  // Humphrey out of its reach.
  noCamel: (c) => {
    c.ABILITY.longshot.camel = false;
  },
  // A hit 1 less beyond 3 spaces, or beyond 2.
  falloff3: (c) => {
    c.ABILITY.longshot.falloff = 3;
  },
  falloff2: (c) => {
    c.ABILITY.longshot.falloff = 2;
  },
  power2: (c) => {
    c.HEROES.archer.power = 2;
  },
  defence0: (c) => {
    c.HEROES.archer.defence = 0;
  },
};
const magus = {
  built: () => {},
  range3: (c) => {
    c.ABILITY.conjunction.range = 3;
  },
  speed3: (c) => {
    c.HEROES.magus.speed = 3;
  },
  defence2: (c) => {
    c.HEROES.magus.defence = 2;
  },
  // Each enemy swapped hit for the Magus's power, at power 1 or 2.
  hit1: (c) => {
    c.ABILITY.conjunction.hit = true;
    c.HEROES.magus.power = 1;
  },
  hit2: (c) => {
    c.ABILITY.conjunction.hit = true;
    c.HEROES.magus.power = 2;
  },
  // Each enemy swapped then Delayed 2 or 3 more.
  delay2: (c) => {
    c.ABILITY.conjunction.delay = 2;
  },
  delay3: (c) => {
    c.ABILITY.conjunction.delay = 3;
  },
  'hit1+range3': (c) => {
    c.ABILITY.conjunction.hit = true;
    c.HEROES.magus.power = 1;
    c.ABILITY.conjunction.range = 3;
  },
};
export const experiments = {};
for (const [hero, variants, steppeSeat, chinaSeat] of [
  ['archer', archer, 1, 0],
  ['magus', magus, 2, 2],
])
  for (const [v, patch] of Object.entries(variants))
    for (const [name, party, i] of [
      ['steppe', steppe, steppeSeat],
      ['china', china, chinaSeat],
    ])
      experiments[`${hero}-${v}-${name}`] = {party, patch, mod: {party: seat(party, i, hero)}};
