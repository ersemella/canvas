// Whole runs with Eye of the Storm (the owner's proposal, 2026-10-27) as
// the Storm Caller's core against Hail (`runs.mjs`): the Steppe party
// through both regions, the core the same on both sides.
const steppe = ['bokh', 'mangudai', 'storm'];
export const experiments = {
  eye: {party: steppe},
  hail: {
    party: steppe,
    patch: ({HEROES}) => {
      HEROES.storm.abilities = ['hail', 'hold'];
    },
  },
};
experiments['heal2+weaken2'] = {
  party: steppe,
  patch: ({ABILITY}) => {
    ABILITY.eye.heal = 1;
    ABILITY.eye.weaken = 2;
  },
};
experiments.imm = {
  party: steppe,
  patch: ({ABILITY}) => {
    ABILITY.eye.immobilize = true;
    ABILITY.eye.weaken = 0;
  },
};
experiments['imm+weaken1'] = {
  party: steppe,
  patch: ({ABILITY}) => {
    ABILITY.eye.immobilize = true;
  },
};
