// The Elixir on one unit within 2 (2026-10-27): an ally healed the
// Alchemist's power and Empowered 2, an enemy hit for its power and
// Weakened 2 (`shape: 'unit'`, `range: 2`, `fixed: 1` for the hit, `heal:
// 'all'`, `empower: 2`, `weaken: 2`), no Haste or Delay. At the Alchemist's
// power 1 (as built) and 2 (one provision). `built`: the Elixir as built
// (one ally within 3, heal 1, Empower 1, Haste 3, power 1).
// *China*: the China party against the Steppe party (`modWinPct`). *Seat*:
// the Alchemist in the Storm Caller's seat against the three Steppe heroes.
const steppe = ['bokh', 'mangudai', 'storm'];
const china = ['youxia', 'modao', 'alchemist'];
const base = {
  shape: 'unit',
  radius: 1,
  delay: 0,
  self: false,
  unstoppable: false,
  swap: false,
  immortal: false,
  immortalWhen: 'now',
  heal: 'all',
};
const built = (c) => {
  Object.assign(c.ABILITY.elixir, base, {range: 3, fixed: 0, empower: 1, weaken: 0, haste: 3});
  c.HEROES.alchemist.power = 1;
};
const range2 = (power) => (c) => {
  Object.assign(c.ABILITY.elixir, base, {range: 2, fixed: 1, empower: 2, weaken: 2, haste: 0});
  c.HEROES.alchemist.power = power;
};
const both = (name, patch) => {
  experiments[`${name}-china-for-steppe`] = {patch, mod: {party: china}};
  experiments[`${name}-alchemist-for-storm`] = {
    patch,
    mod: {party: steppe.map((h) => (h === 'storm' ? 'alchemist' : h))},
  };
};
export const experiments = {};
both('built', built);
both('range2-power1', range2(1));
both('range2-power2', range2(2));
