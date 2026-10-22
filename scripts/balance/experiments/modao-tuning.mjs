// A first re-tuning of the Modao Vanguard, after experiments/modao.mjs
// (2026-10-22): Challenge used on 57% of its turns and its Barrier refreshed
// every 8 slots, Reap on 2%, Advance worth nothing (a side without it won 50%).
const team = ['modao', 'mangudai', 'storm'];

/** Challenge at typical cost, its Barrier lasting 10 slots, under a Low-speed typical turn (14). */
function challenge({ABILITY, ABILITIES}) {
  ABILITY.challenge.cost = 100;
  ABILITIES.challenge.cost = 100;
  ABILITY.challenge.barrierSlots = 10;
}
/** Reap at base 85 (was 70) and Push 3 (was 2). */
function reap({ABILITY}) {
  ABILITY.reap.damage = 85;
  ABILITY.reap.push = 3;
}
/** Advance instant at typical cost, as Freeze became, not charged. */
function advance({ABILITIES}) {
  ABILITIES.advance.charged = false;
  ABILITIES.advance.cost = 100;
}
const all = (config) => [challenge, reap, advance].forEach((f) => f(config));

export const experiments = {
  // Only the Challenge change, against the prototype party.
  'challenge-only-for-bokh': {patch: challenge, mod: {party: team}},
  // All three changes.
  'tuned-for-bokh': {patch: all, mod: {party: team}},
  'tuned-control': {patch: all, party: team, mod: {}},
  ...Object.fromEntries(
    ['reap', 'challenge', 'advance'].map((id) => [
      `tuned-no-${id}`,
      {patch: all, party: team, mod: {ban: [id]}},
    ])
  ),
};
