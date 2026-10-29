// Durations in a fixed number of slots (2026-10-29; the fight's `slots`,
// the test stage's `"rules"`): every effect that lasted until a unit's next
// turn lasting `turn` slots, hail `hail`, a Stun for a turn a Delay of
// `stun`. By each mode (`built`, by turns; `s10`, 10, 18 and 6, the test
// stage's; `s8`, 8, 16 and 6): China against the Steppe (the test stage's
// fight) and against each other region, the Steppe against Persia and
// Byzantium, the Elixir's and hail's worth (one side without), and a point
// of speed on each Steppe and China hero in its region's mirror.
const regions = {
  steppe: ['bokh', 'mangudai', 'storm'],
  china: ['modao', 'youxia', 'alchemist'],
  persia: ['mahout', 'archer', 'magus'],
  byzantium: ['cataphract', 'varangian', 'priest'],
};
const modes = {
  built: undefined,
  s10: {slots: {turn: 10, hail: 18, stun: 6}},
  s8: {slots: {turn: 8, hail: 16, stun: 6}},
};
export const experiments = {};
for (const [m, rules] of Object.entries(modes)) {
  const with_ = (e) => (rules ? {...e, rules} : e);
  for (const region of ['steppe', 'persia', 'byzantium'])
    experiments[`${m}-china-vs-${region}`] = with_({
      party: regions[region],
      mod: {party: regions.china},
    });
  for (const region of ['persia', 'byzantium'])
    experiments[`${m}-steppe-vs-${region}`] = with_({
      party: regions[region],
      mod: {party: regions.steppe},
    });
  experiments[`${m}-no-elixir`] = with_({party: regions.china, mod: {ban: ['elixir']}});
  experiments[`${m}-no-hail`] = with_({party: regions.steppe, mod: {ban: ['hail']}});
  for (const region of ['steppe', 'china'])
    for (const hero of regions[region])
      experiments[`${m}-${hero}-speed+1`] = with_({
        party: regions[region],
        mod: {stats: {[hero]: {speed: 1}}},
      });
}
