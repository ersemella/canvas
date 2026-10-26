// The Alchemist's tuning (2026-10-25): Elixir's shapes
// (`ABILITY.elixir.shape`) with a stat point more, in the Storm Caller's
// seat against the three Steppe heroes (`modWinPct`, 50% its equal).
const seat = ['bokh', 'mangudai', 'alchemist'];
const shapes = {
  unit: {},
  burst: {shape: 'burst', radius: 1},
  aura2: {shape: 'aura', radius: 2},
};
const stats = {defence: {defence: 1}, speed: {speed: 1}, power: {power: 1}};
export const experiments = {};
for (const [name, e] of Object.entries(shapes))
  for (const [stat, add] of Object.entries(stats))
    experiments[`${name}+${stat}`] = {
      patch: (c) => Object.assign(c.ABILITY.elixir, e),
      mod: {party: seat, stats: {alchemist: add}},
    };
