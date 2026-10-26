// Elixir on one ally within 3 (2026-10-26): the Alchemist (power 1, as
// built) heals it its power and makes it Unstoppable until the start of its
// next turn (`ABILITY.elixir.unstoppable`), no Haste or Delay, nothing on an
// enemy, never on itself. `heal-only`: the same without Unstoppable, which
// it is measured against; `built`: the built burst (Haste 3, Delay 3) at
// power 1. *China*: the China party against the Steppe party (`modWinPct`).
// *Seat*: the Alchemist in the Storm Caller's seat against the three
// Steppe heroes.
const steppe = ['bokh', 'mangudai', 'storm'];
const china = ['youxia', 'modao', 'alchemist'];
const none = {fixed: 0, empower: 0, weaken: 0, self: false};
const single = (unstoppable) => (c) => {
  Object.assign(c.ABILITY.elixir, none, {
    shape: 'unit',
    range: 3,
    radius: 1,
    heal: 'all',
    haste: 0,
    delay: 0,
    unstoppable,
  });
  c.HEROES.alchemist.power = 1;
};
const built = (c) => {
  Object.assign(c.ABILITY.elixir, none, {
    shape: 'burst',
    range: 1,
    radius: 1,
    heal: false,
    haste: 3,
    delay: 3,
    unstoppable: false,
  });
  c.HEROES.alchemist.power = 1;
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
both('heal-unstoppable', single(true));
both('heal-only', single(false));
