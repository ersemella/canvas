// Elixir as Haste and Delay (`ABILITY.elixir.tempo`, no Empower or Weaken)
// in other shapes, the Alchemist never taking its own (`self` off), so it
// can't Hasten itself (2026-10-26; elixir-tempo.mjs measured the built burst,
// the Alchemist in it). *China*: the China party against the Steppe party
// (`modWinPct`). *Seat*: the Alchemist in the Storm Caller's seat against the
// three Steppe heroes (50% the Storm Caller's equal).
const steppe = ['bokh', 'mangudai', 'storm'];
const china = ['youxia', 'modao', 'alchemist'];
const shapes = {
  // The built burst: a space next to the Alchemist, or its own, radius 1.
  'burst-1': {shape: 'burst', range: 1, radius: 1},
  // Thrown: a space within 2, radius 1.
  'burst-2': {shape: 'burst', range: 2, radius: 1},
  // One unit within 2 or 3.
  'unit-2': {shape: 'unit', range: 2},
  'unit-3': {shape: 'unit', range: 3},
};
export const experiments = {};
for (const [shape, s] of Object.entries(shapes))
  for (const tempo of [2, 3, 4]) {
    const patch = (c) => {
      Object.assign(
        c.ABILITY.elixir,
        {radius: 1, fixed: 0, heal: false, empower: 0, weaken: 0, self: false},
        s,
        {tempo}
      );
      c.HEROES.alchemist.power = 0;
    };
    experiments[`${shape}-tempo-${tempo}-china-for-steppe`] = {patch, mod: {party: china}};
    experiments[`${shape}-tempo-${tempo}-alchemist-for-storm`] = {
      patch,
      mod: {party: steppe.map((h) => (h === 'storm' ? 'alchemist' : h))},
    };
  }
