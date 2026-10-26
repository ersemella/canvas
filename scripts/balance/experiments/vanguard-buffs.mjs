// Buffs for the Vanguard other than speed, which keep its kit a slow
// tank's (owner, 2026-10-26): each with Swift Strike Haste 3, China's party
// against the Steppe's (`china-buffs.mjs`: speed 2 and Haste 3 gave 51.7%),
// and the Vanguard alone in the Grappler's seat (speed 2: 45.9%; as built
// 40%). `modWinPct` is China's share, or the seat's.
const china = ['youxia', 'modao', 'alchemist'];
const seat = ['modao', 'mangudai', 'storm'];
const buffs = {
  none: {},
  'cleave-reach-3': {patch: (c) => (c.ABILITY.cleave.reach = 3)},
  'cleave-delay-8': {patch: (c) => (c.ABILITY.cleave.delay = 8)},
  'defence+1': {stats: {modao: {defence: 1}}},
  'defence+2': {stats: {modao: {defence: 2}}},
  'power+1': {stats: {modao: {power: 1}}},
  'walk-3': {patch: (c) => (c.HEROES.modao.moveCap = 3)},
};
export const experiments = {};
for (const [name, {patch, stats}] of Object.entries(buffs)) {
  experiments[`china-haste-3-${name}`] = {
    mod: {party: china, ...(stats && {stats})},
    patch: (c) => {
      c.ABILITY.swiftStrike.haste = 3;
      patch?.(c);
    },
  };
  if (name !== 'none')
    experiments[`seat-${name}`] = {
      mod: {party: seat, ...(stats && {stats})},
      ...(patch && {patch}),
    };
}
// Delay 7, between as built and 8.
experiments['china-haste-3-cleave-delay-7'] = {
  mod: {party: china},
  patch: (c) => {
    c.ABILITY.swiftStrike.haste = 3;
    c.ABILITY.cleave.delay = 7;
  },
};
experiments['seat-cleave-delay-7'] = {
  mod: {party: seat},
  patch: (c) => (c.ABILITY.cleave.delay = 7),
};
