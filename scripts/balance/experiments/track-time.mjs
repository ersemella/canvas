// Track time (2026-10-29; `RULES.trackTime`, `RULES.stunAsDelay`): the
// effects lasting by turns (Empower, Weaken, Shield, hail, Princess Iron
// Fan's fire) lasting a window of slots instead, by each mode: `built`, by
// turns; `own`, a turn of slots the unit's action cost when given; `s10`
// and `s12`, 10 and 12 slots a turn for every unit. Each mode measures the
// four regions' parties against each other, the abilities those effects
// come from (one side without), a point of speed on each hero in its own
// region's mirror (whether a window of slots makes speed worth more), and
// the China boss stage against the Steppe party. `own-stun` adds the slam
// and Last Stand as a Delay of the unit's action cost to `own`, in the
// rows the slam touches.
const regions = {
  steppe: ['bokh', 'mangudai', 'storm'],
  china: ['modao', 'youxia', 'alchemist'],
  persia: ['mahout', 'archer', 'magus'],
  byzantium: ['cataphract', 'varangian', 'priest'],
};
const modes = {built: false, own: 'own', s10: 10, s12: 12};
const effectAbilities = {steppe: 'hail', china: 'elixir', byzantium: 'blessing'};
const rows = (prefix, patch) => {
  const out = {};
  const names = Object.keys(regions);
  for (const [i, a] of names.entries())
    for (const b of names.slice(i + 1))
      out[`${prefix}-${b}-vs-${a}`] = {patch, party: regions[a], mod: {party: regions[b]}};
  for (const [region, ability] of Object.entries(effectAbilities))
    out[`${prefix}-no-${ability}`] = {patch, party: regions[region], mod: {ban: [ability]}};
  for (const party of Object.values(regions))
    for (const hero of party)
      out[`${prefix}-${hero}-speed+1`] = {
        patch,
        party,
        mod: {stats: {[hero]: {speed: 1}}},
      };
  out[`${prefix}-boss-china`] = {patch, enemies: ['oxKing', 'fanLady']};
  return out;
};
export const experiments = {};
for (const [name, mode] of Object.entries(modes))
  Object.assign(
    experiments,
    rows(name, (c) => {
      c.RULES.trackTime = mode;
    })
  );
const ownStun = (c) => {
  c.RULES.trackTime = 'own';
  c.RULES.stunAsDelay = true;
};
for (const [name, e] of Object.entries(rows('own-stun', ownStun)))
  if (/byzantium|cataphract|no-blessing/.test(name)) experiments[name] = e;
experiments['own-stun-no-charge'] = {
  patch: ownStun,
  party: regions.byzantium,
  mod: {ban: ['charge']},
};
experiments['own-no-charge'] = {
  patch: (c) => {
    c.RULES.trackTime = 'own';
  },
  party: regions.byzantium,
  mod: {ban: ['charge']},
};
experiments['built-no-charge'] = {party: regions.byzantium, mod: {ban: ['charge']}};
