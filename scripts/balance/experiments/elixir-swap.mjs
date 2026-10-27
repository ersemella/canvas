// The Elixir swapping an ally's speed and health (2026-10-27): one ally
// within 3, never the Alchemist or the camel, swaps its speed and its
// health (`ABILITY.elixir.swap`), the Alchemist's power 0, no heal, Empower
// or Haste. `pool`: the swapped health a pool of its own, its own back
// untouched unless it fell; `carry`: what it gains or loses meanwhile
// carried back, falling if none is left. `end`: until the end of its next
// turn, its card placed after it at the swapped speed; `start`: until the
// start of it (`ABILITY.elixir.swapUntil`). `built`: the Elixir as built
// (heal 1, Empower 1, Haste 3, power 1). *China*: the China party against
// the Steppe party (`modWinPct`). *Seat*: the Alchemist in the Storm
// Caller's seat against the three Steppe heroes. `risk`: `AI.swapRisk`, what
// the AI's first guess counts each point of health the ally loses for now.
const steppe = ['bokh', 'mangudai', 'storm'];
const china = ['youxia', 'modao', 'alchemist'];
const base = {
  shape: 'unit',
  range: 3,
  radius: 1,
  fixed: 0,
  weaken: 0,
  delay: 0,
  self: false,
  unstoppable: false,
};
const built = (c) => {
  Object.assign(c.ABILITY.elixir, base, {
    heal: 'all',
    empower: 1,
    haste: 3,
    swap: false,
    swapUntil: 'end',
  });
  c.HEROES.alchemist.power = 1;
};
const swapping =
  (swap, swapUntil, risk = 0.5) =>
  (c) => {
    Object.assign(c.ABILITY.elixir, base, {heal: false, empower: 0, haste: 0, swap, swapUntil});
    c.HEROES.alchemist.power = 0;
    c.AI.swapRisk = risk;
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
for (const swap of ['pool', 'carry'])
  for (const until of ['end', 'start'])
    for (const risk of [0.5, 0]) both(`${swap}-${until}-risk${risk}`, swapping(swap, until, risk));
