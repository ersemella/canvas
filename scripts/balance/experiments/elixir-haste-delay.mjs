// Elixir with more Haste than Delay (2026-10-26): the built burst (a space
// next to the Alchemist, radius 1), the Alchemist never taking its own
// (`self` off), allies Hastened `haste` and enemies Delayed `delay`
// (`ABILITY.elixir.haste`, `.delay`), no Empower or Weaken. `ai-*`: the same
// with the AI screening its options with Haste and Delay counted
// (`AI.trackWorth` 1), against the built Elixir under that AI.
// *China*: the China party against the Steppe party (`modWinPct`). *Seat*:
// the Alchemist in the Storm Caller's seat against the three Steppe heroes.
// `hastesPerFight.elixir.to` counts the Hastes by ally.
const steppe = ['bokh', 'mangudai', 'storm'];
const china = ['youxia', 'modao', 'alchemist'];
const burst = {shape: 'burst', range: 1, radius: 1, fixed: 0, heal: false, self: false};
const pairs = [
  [3, 3],
  [3, 0],
  [4, 0],
  [3, 1],
  [4, 1],
  [5, 1],
  [4, 2],
];
const tempo = (haste, delay) => (c) => {
  Object.assign(c.ABILITY.elixir, burst, {empower: 0, weaken: 0, haste, delay});
  c.HEROES.alchemist.power = 0;
};
const builtElixir = (c) => {
  Object.assign(c.ABILITY.elixir, burst, {self: true, empower: 2, weaken: 1, haste: 0, delay: 0});
  c.HEROES.alchemist.power = 0;
};
const withAi = (patch) => (c) => {
  patch(c);
  c.AI.trackWorth = 1;
};
const both = (name, patch) => {
  experiments[`${name}-china-for-steppe`] = {patch, mod: {party: china}};
  experiments[`${name}-alchemist-for-storm`] = {
    patch,
    mod: {party: steppe.map((h) => (h === 'storm' ? 'alchemist' : h))},
  };
};
export const experiments = {};
for (const [h, d] of pairs) both(`haste-${h}-delay-${d}`, tempo(h, d));
both('ai-built', withAi(builtElixir));
for (const [h, d] of [
  [3, 3],
  [4, 1],
])
  both(`ai-haste-${h}-delay-${d}`, withAi(tempo(h, d)));
