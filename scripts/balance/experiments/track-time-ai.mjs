// Track time with an AI that counts windows (2026-10-29; `AI.windows`,
// after track-time.mjs): by each mode (`built`, by turns; `own`, a turn of
// slots the unit's action cost when given; `s10` and `s12`, 10 and 12 slots
// a turn), the AI counting windows against the one that doesn't (`aware`,
// the modified side's AI only), in the mirrors with timed effects and in
// every region's mirror with Rally on its tank (both sides); Rally's worth
// on the tank (one side); and track-time.mjs's rows again with the aware AI:
// the Elixir's and hail's worth, a point of speed on each Steppe and China
// hero, and the regions' parties against each other.
const regions = {
  steppe: ['bokh', 'mangudai', 'storm'],
  china: ['modao', 'youxia', 'alchemist'],
  persia: ['mahout', 'archer', 'magus'],
  byzantium: ['cataphract', 'varangian', 'priest'],
};
const tanks = {steppe: 'bokh', china: 'modao', persia: 'mahout', byzantium: 'cataphract'};
const modes = {built: false, own: 'own', s10: 10, s12: 12};
const rules = (mode, more) => (c) => {
  c.RULES.trackTime = mode;
  more?.(c);
};
const naive = (c) => {
  c.AI.windows = false;
};
const rallyAll = (c) => {
  for (const tank of Object.values(tanks))
    c.HEROES[tank].passives = [...(c.HEROES[tank].passives ?? []), 'rally'];
};
export const experiments = {};
for (const [m, mode] of Object.entries(modes)) {
  if (mode) {
    for (const region of ['steppe', 'china'])
      experiments[`${m}-aware-${region}`] = {
        patch: rules(mode, naive),
        party: regions[region],
        mod: {ai: {windows: true}},
      };
    for (const [region, party] of Object.entries(regions))
      experiments[`${m}-aware-rally-${region}`] = {
        patch: rules(mode, (c) => {
          naive(c);
          rallyAll(c);
        }),
        party,
        mod: {ai: {windows: true}},
      };
  }
  for (const [region, party] of Object.entries(regions))
    experiments[`${m}-rally-${region}`] = {
      patch: rules(mode),
      party,
      mod: {passives: {[tanks[region]]: ['rally']}},
    };
  experiments[`${m}-no-elixir`] = {
    patch: rules(mode),
    party: regions.china,
    mod: {ban: ['elixir']},
  };
  experiments[`${m}-no-hail`] = {patch: rules(mode), party: regions.steppe, mod: {ban: ['hail']}};
  for (const region of ['steppe', 'china'])
    for (const hero of regions[region])
      experiments[`${m}-${hero}-speed+1`] = {
        patch: rules(mode),
        party: regions[region],
        mod: {stats: {[hero]: {speed: 1}}},
      };
  const names = Object.keys(regions);
  for (const [i, a] of names.entries())
    for (const b of names.slice(i + 1))
      experiments[`${m}-${b}-vs-${a}`] = {
        patch: rules(mode),
        party: regions[a],
        mod: {party: regions[b]},
      };
}
