// Eye of the Storm (the owner's proposal, 2026-10-27) as the Storm Caller's
// core in place of Hail: an ally exactly 2 away or itself heals the Storm
// Caller's power (with its Empower and Weaken), and every unit next to it
// that hits is Weakened 1. Run on the rules with it built, Hail an upgrade.
// *Head to head*: one side's Storm Caller with Hail as its core (`mod.kits`),
// alone and with each upgrade, against Eye with the same upgrade
// (`modWinPct` above 50%: Hail the stronger). *Worth*: Eye banned on one
// side. *Seat*: a Chinese hero in the Storm Caller's seat, with each core
// (50% their equal, lower a stronger Storm Caller). *Caravans*: the stage
// caravans with a Storm Caller against the full party, with each core
// (`playerWinPct`).
const steppe = ['bokh', 'mangudai', 'storm'];
const china = ['youxia', 'modao', 'alchemist'];
const cores = {
  eye: undefined,
  hail: ({HEROES}) => {
    HEROES.storm.abilities = ['hail', 'hold'];
  },
};
export const experiments = {
  'hail-vs-eye': {mod: {kits: {storm: ['hail', 'hold']}}},
  'no-eye': {mod: {ban: ['eye']}},
};
for (const up of ['sunlight', 'gale']) {
  const patch = ({HEROES}) => {
    HEROES.storm.abilities = ['eye', up, 'hold'];
  };
  experiments[`hail+${up}-vs-eye+${up}`] = {patch, mod: {kits: {storm: ['hail', up, 'hold']}}};
}
for (const [core, patch] of Object.entries(cores)) {
  for (const hero of china)
    experiments[`${core}:${hero}-for-storm`] = {
      patch,
      mod: {party: steppe.map((h) => (h === 'storm' ? hero : h))},
    };
  experiments[`${core}:vs-storm+2wolves`] = {patch, enemies: ['storm', 'wolf', 'wolf']};
  experiments[`${core}:vs-bokh+storm+wolf`] = {patch, enemies: ['bokh', 'storm', 'wolf']};
  experiments[`${core}:vs-mangudai+storm+wolf`] = {patch, enemies: ['mangudai', 'storm', 'wolf']};
  experiments[`${core}:vs-all-three`] = {patch, enemies: steppe};
}
// Asked for (2026-10-27): Eye healing 2 (`ABILITY.eye.heal` 1 over power 1),
// Weakening 2, and both, each head to head against Hail, its worth, and
// each Chinese hero in the Storm Caller's seat.
const tunings = {
  heal2: (c) => {
    c.ABILITY.eye.heal = 1;
  },
  weaken2: (c) => {
    c.ABILITY.eye.weaken = 2;
  },
  'heal2+weaken2': (c) => {
    c.ABILITY.eye.heal = 1;
    c.ABILITY.eye.weaken = 2;
  },
};
for (const [name, patch] of Object.entries(tunings)) {
  experiments[`${name}:hail-vs-eye`] = {patch, mod: {kits: {storm: ['hail', 'hold']}}};
  experiments[`${name}:no-eye`] = {patch, mod: {ban: ['eye']}};
  for (const hero of china)
    experiments[`${name}:${hero}-for-storm`] = {
      patch,
      mod: {party: steppe.map((h) => (h === 'storm' ? hero : h))},
    };
}
// Asked for (2026-10-27): the storm round Eye's target Immobilizing every
// unit in it until the end of its next turn (`ABILITY.eye.immobilize`), in
// place of the Weaken, beside it, and with heal 2.
const immobilizing = {
  imm: (c) => {
    c.ABILITY.eye.immobilize = true;
    c.ABILITY.eye.weaken = 0;
  },
  'imm+weaken1': (c) => {
    c.ABILITY.eye.immobilize = true;
  },
  'imm+heal2': (c) => {
    c.ABILITY.eye.immobilize = true;
    c.ABILITY.eye.weaken = 0;
    c.ABILITY.eye.heal = 1;
  },
};
for (const [name, patch] of Object.entries(immobilizing)) {
  experiments[`${name}:hail-vs-eye`] = {patch, mod: {kits: {storm: ['hail', 'hold']}}};
  experiments[`${name}:no-eye`] = {patch, mod: {ban: ['eye']}};
  for (const hero of china)
    experiments[`${name}:${hero}-for-storm`] = {
      patch,
      mod: {party: steppe.map((h) => (h === 'storm' ? hero : h))},
    };
}
// Asked for (2026-10-27): heal and Weaken again, the Storm Caller able to
// open the eye on an empty space 2 away too (`ABILITY.eye.anywhere`), at
// heal 1 and Weaken 1 and at heal 2 and Weaken 2.
const anywhere = {
  anywhere: (c) => {
    c.ABILITY.eye.anywhere = true;
  },
  'anywhere+heal2+weaken2': (c) => {
    c.ABILITY.eye.anywhere = true;
    c.ABILITY.eye.heal = 1;
    c.ABILITY.eye.weaken = 2;
  },
};
for (const [name, patch] of Object.entries(anywhere)) {
  experiments[`${name}:hail-vs-eye`] = {patch, mod: {kits: {storm: ['hail', 'hold']}}};
  experiments[`${name}:no-eye`] = {patch, mod: {ban: ['eye']}};
  for (const hero of china)
    experiments[`${name}:${hero}-for-storm`] = {
      patch,
      mod: {party: steppe.map((h) => (h === 'storm' ? hero : h))},
    };
}
// Asked for (2026-10-27): on an empty space too, healing and Immobilizing
// (no Weaken), at heal 1 and heal 2; head to head against Hail only.
experiments['anywhere+imm:hail-vs-eye'] = {
  patch: (c) => {
    Object.assign(c.ABILITY.eye, {anywhere: true, immobilize: true, weaken: 0});
  },
  mod: {kits: {storm: ['hail', 'hold']}},
};
experiments['anywhere+imm+heal2:hail-vs-eye'] = {
  patch: (c) => {
    Object.assign(c.ABILITY.eye, {anywhere: true, immobilize: true, weaken: 0, heal: 1});
  },
  mod: {kits: {storm: ['hail', 'hold']}},
};
// Asked for (2026-10-27): Eye healing and hitting every unit in the storm,
// both its power (`ABILITY.eye.damage`), no Weaken; on an ally only and on
// an empty space too; head to head against Hail only.
experiments['damage:hail-vs-eye'] = {
  patch: (c) => {
    Object.assign(c.ABILITY.eye, {damage: true, weaken: 0});
  },
  mod: {kits: {storm: ['hail', 'hold']}},
};
experiments['anywhere+damage:hail-vs-eye'] = {
  patch: (c) => {
    Object.assign(c.ABILITY.eye, {anywhere: true, damage: true, weaken: 0});
  },
  mod: {kits: {storm: ['hail', 'hold']}},
};
// Asked for (2026-10-27): how Eye's heal and hit scale with power, as
// provisions raise it. Both sides' Storm Callers at power 2 and 3, Hail
// against Eye (hitting, on an empty space too, and on an ally only).
for (const power of [2, 3])
  for (const [name, eye] of [
    ['anywhere+damage', {anywhere: true, damage: true, weaken: 0}],
    ['damage', {damage: true, weaken: 0}],
  ])
    experiments[`power${power}:${name}:hail-vs-eye`] = {
      patch: (c) => {
        c.HEROES.storm.power = power;
        Object.assign(c.ABILITY.eye, eye);
      },
      mod: {kits: {storm: ['hail', 'hold']}},
    };
// Asked for (2026-10-27): Eye hitting (on an ally only, and on an empty
// space too) against the game's balance, at power 1: its worth, each
// Chinese hero in its seat, and the stage caravans with a Storm Caller.
for (const [name, eye] of [
  ['damage', {damage: true, weaken: 0}],
  ['anywhere+damage', {anywhere: true, damage: true, weaken: 0}],
]) {
  const patch = (c) => {
    Object.assign(c.ABILITY.eye, eye);
  };
  experiments[`${name}:no-eye`] = {patch, mod: {ban: ['eye']}};
  for (const hero of china)
    experiments[`${name}:${hero}-for-storm`] = {
      patch,
      mod: {party: steppe.map((h) => (h === 'storm' ? hero : h))},
    };
  experiments[`${name}:vs-storm+2wolves`] = {patch, enemies: ['storm', 'wolf', 'wolf']};
  experiments[`${name}:vs-bokh+storm+wolf`] = {patch, enemies: ['bokh', 'storm', 'wolf']};
  experiments[`${name}:vs-mangudai+storm+wolf`] = {patch, enemies: ['mangudai', 'storm', 'wolf']};
  experiments[`${name}:vs-all-three`] = {patch, enemies: steppe};
}
