// Grapple off the track (2026-10-29; the fight's `grapple: 'offTrack'`,
// the test stage's `"rules"`): a grappled unit's card leaves the track
// while the grapple holds, and comes back just before the Grappler's next
// card. By each mode (`built`, Stunned by turns; `off`, off the track;
// `s8-off`, off the track with durations in slots 8/16/6, the test
// stage's): Grapple's worth (the Steppe without it), the Grappler's speed
// and power, the Steppe against each other region, and the Grappler in
// China's, Persia's and Byzantium's tank seats.
const regions = {
  steppe: ['bokh', 'mangudai', 'storm'],
  china: ['modao', 'youxia', 'alchemist'],
  persia: ['mahout', 'archer', 'magus'],
  byzantium: ['cataphract', 'varangian', 'priest'],
};
const modes = {
  built: undefined,
  off: {grapple: 'offTrack'},
  's8-off': {grapple: 'offTrack', slots: {turn: 8, hail: 16, stun: 6}},
};
const seat = (party, i, hero) => party.map((h, j) => (j === i ? hero : h));
export const experiments = {};
for (const [m, rules] of Object.entries(modes)) {
  const with_ = (e) => (rules ? {...e, rules} : e);
  experiments[`${m}-no-grapple`] = with_({party: regions.steppe, mod: {ban: ['grapple']}});
  for (const stat of ['speed', 'power'])
    experiments[`${m}-bokh-${stat}+1`] = with_({
      party: regions.steppe,
      mod: {stats: {bokh: {[stat]: 1}}},
    });
  for (const region of ['china', 'persia', 'byzantium']) {
    experiments[`${m}-steppe-vs-${region}`] = with_({
      party: regions[region],
      mod: {party: regions.steppe},
    });
    experiments[`${m}-bokh-for-tank-${region}`] = with_({
      party: regions[region],
      mod: {party: seat(regions[region], 0, 'bokh')},
    });
  }
}
