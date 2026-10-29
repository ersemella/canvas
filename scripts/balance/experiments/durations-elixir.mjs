// Durations by power and defence, step 1 (2026-10-29; `FightRules.ticks`,
// the test stage's `"rules"`): the Elixir's Empower and Weaken lasting a
// turn of the target's slots, plus `power` slots a point of the
// Alchemist's power, a Weaken `defence` fewer a point of the target's
// defence. By each mode (`built`, by turns; `t0`, slots with neither;
// `k1`, 1 and 1; `k2`, 2 and 2): a point of the Alchemist's power, speed
// and defence, a point of defence on the Vanguard and the Duelist (fewer
// slots of the other Alchemist's Weaken), the Elixir's worth (one side
// without), all in China's mirror, and China against each other region.
const regions = {
  steppe: ['bokh', 'mangudai', 'storm'],
  china: ['modao', 'youxia', 'alchemist'],
  persia: ['mahout', 'archer', 'magus'],
  byzantium: ['cataphract', 'varangian', 'priest'],
};
const modes = {
  built: undefined,
  t0: {ticks: {power: 0, defence: 0}},
  k1: {ticks: {power: 1, defence: 1}},
  k2: {ticks: {power: 2, defence: 2}},
};
export const experiments = {};
for (const [m, rules] of Object.entries(modes)) {
  const china = {party: regions.china, ...(rules ? {rules} : {})};
  for (const stat of ['power', 'speed', 'defence'])
    experiments[`${m}-alchemist-${stat}+1`] = {...china, mod: {stats: {alchemist: {[stat]: 1}}}};
  for (const hero of ['modao', 'youxia'])
    experiments[`${m}-${hero}-defence+1`] = {...china, mod: {stats: {[hero]: {defence: 1}}}};
  experiments[`${m}-no-elixir`] = {...china, mod: {ban: ['elixir']}};
  for (const region of ['steppe', 'persia', 'byzantium'])
    experiments[`${m}-china-vs-${region}`] = {
      party: regions[region],
      ...(rules ? {rules} : {}),
      mod: {party: regions.china},
    };
}
