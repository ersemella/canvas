// Elixir's shape and Cleave's Delay (2026-10-25), by the switches
// `ABILITY.elixir.shape` (`range`, `radius`) and `ABILITY.cleave.delay`.
// Each variant twice: the Chinese hero in the Storm Caller's seat against
// the three Steppe heroes (`modWinPct`, 50% the Storm Caller's equal), and
// the China line-up against the Steppe party on the Gobi (`playerWinPct`).
const china = ['fox', 'modao', 'alchemist'];
const elixir = {
  'unit-2': {},
  'unit-3': {range: 3},
  'burst-1': {shape: 'burst', radius: 1},
  'aura-1': {shape: 'aura', radius: 1},
  'aura-2': {shape: 'aura', radius: 2},
};
const delays = [0, 2, 3, 5];
export const experiments = {};
for (const [name, e] of Object.entries(elixir)) {
  const patch = (c) => Object.assign(c.ABILITY.elixir, e);
  experiments[`elixir-${name}-seat`] = {patch, mod: {party: ['bokh', 'mangudai', 'alchemist']}};
  experiments[`elixir-${name}-china`] = {patch, enemies: china, map: 'gobi'};
}
for (const d of delays) {
  const patch = (c) => (c.ABILITY.cleave.delay = d);
  experiments[`cleave-delay-${d}-seat`] = {patch, mod: {party: ['bokh', 'mangudai', 'modao']}};
  experiments[`cleave-delay-${d}-china`] = {patch, enemies: china, map: 'gobi'};
}
experiments['both-aura-2-delay-3-china'] = {
  patch: (c) => {
    Object.assign(c.ABILITY.elixir, elixir['aura-2']);
    c.ABILITY.cleave.delay = 3;
  },
  enemies: china,
  map: 'gobi',
};
