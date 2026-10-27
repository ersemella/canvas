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
