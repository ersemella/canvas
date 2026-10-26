// Why the China party loses to the Steppe's (china-steppe.mjs, 36.8%) and
// what would close it. Every experiment is the China party (`mod.party`)
// against the Steppe's, `modWinPct` China's share, unless it says otherwise.
const steppe = ['bokh', 'mangudai', 'storm'];
const china = ['youxia', 'modao', 'alchemist'];
const deep = {depth: 4, work: 4 * 220};
const vs = (extra = {}) => ({mod: {party: china, ...extra}});
export const experiments = {
  china: vs(),
  // The AI: a deeper search for China, and for the Steppe against China. If
  // China's kits are what the production AI underplays, China gains more.
  'china-deep': vs({search: deep}),
  'steppe-vs-china': {party: china, mod: {party: steppe}},
  'steppe-deep-vs-china': {party: china, mod: {party: steppe, search: deep}},
  // The AI's caution (threat avoidance), the other way for two heroes.
  'youxia-caution-0': {...vs(), patch: (c) => (c.AI.caution.youxia = 0)},
  'modao-caution-1': {...vs(), patch: (c) => (c.AI.caution.modao = 1)},
  // Buffs, China's side only.
  'youxia-defence+1': vs({stats: {youxia: {defence: 1}}}),
  'youxia-power+1': vs({stats: {youxia: {power: 1}}}),
  'youxia-speed+1': vs({stats: {youxia: {speed: 1}}}),
  'swift-strike-haste-4': {...vs(), patch: (c) => (c.ABILITY.swiftStrike.haste = 4)},
  'modao-speed+1': vs({stats: {modao: {speed: 1}}}),
  'modao-power+1': vs({stats: {modao: {power: 1}}}),
  'alchemist-power+1': vs({stats: {alchemist: {power: 1}}}),
  'alchemist-defence+1': vs({stats: {alchemist: {defence: 1}}}),
  'elixir-range-3': {...vs(), patch: (c) => (c.ABILITY.elixir.range = 3)},
  'all-defence+1': vs({
    stats: {youxia: {defence: 1}, modao: {defence: 1}, alchemist: {defence: 1}},
  }),
};
// Both sides on the deeper search: China's share with neither AI the weaker.
experiments['both-deep'] = {
  ...vs(),
  patch: (c) => {
    c.AI.searchDepth = deep.depth;
    c.AI.maxSimulations = deep.work;
  },
};
// The buffs that close the gap, in a Steppe hero's seat (china-steppe.mjs's
// seats: the Alchemist for the Storm Caller 55%, the Swordsman for the Horse Archer
// 46.9%): a buff that evens China shouldn't make the hero a must-pick.
experiments['elixir-range-3-for-storm'] = {
  mod: {party: ['bokh', 'mangudai', 'alchemist']},
  patch: (c) => (c.ABILITY.elixir.range = 3),
};
experiments['youxia-speed+1-for-mangudai'] = {
  mod: {party: ['bokh', 'youxia', 'storm'], stats: {youxia: {speed: 1}}},
};
experiments['alchemist-power+1-for-storm'] = {
  mod: {party: ['bokh', 'mangudai', 'alchemist'], stats: {alchemist: {power: 1}}},
};
// Smaller buffs on the two heroes under 50% in their seats, together.
const haste4 = (c) => (c.ABILITY.swiftStrike.haste = 4);
experiments['modao-speed+1+haste-4'] = {...vs({stats: {modao: {speed: 1}}}), patch: haste4};
experiments['modao-speed+1-for-bokh'] = {
  mod: {party: ['modao', 'mangudai', 'storm'], stats: {modao: {speed: 1}}},
};
experiments['haste-4-for-mangudai'] = {mod: {party: ['bokh', 'youxia', 'storm']}, patch: haste4};
const haste3 = (c) => (c.ABILITY.swiftStrike.haste = 3);
experiments['modao-speed+1+haste-3'] = {...vs({stats: {modao: {speed: 1}}}), patch: haste3};
experiments['haste-3-for-mangudai'] = {mod: {party: ['bokh', 'youxia', 'storm']}, patch: haste3};
