// The Modao Vanguard's second re-tuning, after experiments/modao-tuning.mjs
// (2026-10-22): Reap at base 85 and Push 3 and Advance instant worked;
// Challenge at typical cost fell to 3% of turns and the Vanguard's team to
// 36% against the prototype party. Three middle grounds for Challenge.
const team = ['modao', 'mangudai', 'storm'];

function kept({ABILITY, ABILITIES}) {
  ABILITY.reap.damage = 85;
  ABILITY.reap.push = 3;
  ABILITIES.advance.charged = false;
  ABILITIES.advance.cost = 100;
}
function challengeCost(config, cost) {
  config.ABILITY.challenge.cost = cost;
  config.ABILITIES.challenge.cost = cost;
}
const options = {
  // Quick, its Barrier for 6 slots, short of a quick turn at Low speed (8).
  quick6: (c) => {
    kept(c);
    challengeCost(c, 60);
    c.ABILITY.challenge.barrierSlots = 6;
  },
  // Cost 80 (11 slots at Low speed), its Barrier for 10.
  mid10: (c) => {
    kept(c);
    challengeCost(c, 80);
    c.ABILITY.challenge.barrierSlots = 10;
  },
  // quick6, with speed 15 instead of 10.
  quick6speed15: (c) => {
    options.quick6(c);
    c.HEROES.modao.speed = 15;
  },
};
export const experiments = Object.fromEntries(
  Object.entries(options).flatMap(([name, patch]) => [
    [`${name}-for-bokh`, {patch, mod: {party: team}}],
    [`${name}-control`, {patch, party: team, mod: {}}],
    [`${name}-no-challenge`, {patch, party: team, mod: {ban: ['challenge']}}],
  ])
);
