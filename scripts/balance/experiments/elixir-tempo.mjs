// Elixir with Haste and Delay in place of Empower and Weaken (2026-10-26):
// the built burst (a space next to the Alchemist, radius 1), its allies
// Hastened and its enemies Delayed `tempo` slots, no Empower or Weaken
// (`ABILITY.elixir.empower`, `.weaken` 0), against the built Elixir.
// *China*: the China party against the Steppe party (`modWinPct`).
// *Seat*: the Alchemist in the Storm Caller's seat against the three Steppe
// heroes (50% the Storm Caller's equal). `delaysPerFight.*.again` counts
// Delays on a unit already Delayed since its last turn.
const steppe = ['bokh', 'mangudai', 'storm'];
const china = ['youxia', 'modao', 'alchemist'];
const burst = {shape: 'burst', range: 1, radius: 1, fixed: 0, heal: false};
const variants = {
  built: {empower: 2, weaken: 1, tempo: 0},
  'tempo-2': {empower: 0, weaken: 0, tempo: 2},
  'tempo-3': {empower: 0, weaken: 0, tempo: 3},
  'tempo-4': {empower: 0, weaken: 0, tempo: 4},
};
export const experiments = {};
for (const [name, v] of Object.entries(variants)) {
  const patch = (c) => {
    Object.assign(c.ABILITY.elixir, burst, v);
    c.HEROES.alchemist.power = 0;
  };
  experiments[`${name}-china-for-steppe`] = {patch, mod: {party: china}};
  experiments[`${name}-alchemist-for-storm`] = {
    patch,
    mod: {party: steppe.map((h) => (h === 'storm' ? 'alchemist' : h))},
  };
}
