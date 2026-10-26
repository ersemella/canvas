// The Vanguard's third re-tuning, after experiments/modao-tuning-2.mjs
// (2026-10-22): the owner keeps it slow (speed 10). On the best Challenge
// (quick, Barrier for 6 slots), Reap Push 3 and Advance instant, Reap's
// damage is raised instead of speed.
const team = ['modao', 'mangudai', 'storm'];

function base({ABILITY, ABILITIES}) {
  ABILITY.reap.push = 3;
  ABILITIES.advance.charged = false;
  ABILITIES.advance.cost = 100;
  ABILITY.challenge.barrierSlots = 6;
}
const options = Object.fromEntries(
  [100, 115, 130].map((damage) => [
    `reap${damage}`,
    (c) => {
      base(c);
      c.ABILITY.reap.damage = damage;
    },
  ])
);
export const experiments = Object.fromEntries(
  Object.entries(options).flatMap(([name, patch]) => [
    [`${name}-for-bokh`, {patch, mod: {party: team}}],
    [`${name}-control`, {patch, party: team, mod: {}}],
    [`${name}-no-reap`, {patch, party: team, mod: {ban: ['reap']}}],
  ])
);
