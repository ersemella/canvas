// The Elixir granting Immortal until the ally's next turn (2026-10-27): one
// ally within 3, never the Alchemist, is Immortal (keywords.md 17.6: its
// health can't be reduced, its Shield still takes damage) until the start
// of its next turn (`ABILITY.elixir.immortal`), the Alchemist's power 0, no
// heal, Empower or Haste. `heroes`: not the camel; `all`: the camel too.
// `built`: the Elixir as built (heal 1, Empower 1, Haste 3, power 1).
// *China*: the China party against the Steppe party (`modWinPct`). *Seat*:
// the Alchemist in the Storm Caller's seat against the three Steppe heroes.
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
  swap: false,
};
const built = (c) => {
  Object.assign(c.ABILITY.elixir, base, {heal: 'all', empower: 1, haste: 3, immortal: false});
  c.HEROES.alchemist.power = 1;
};
const immortal = (who) => (c) => {
  Object.assign(c.ABILITY.elixir, base, {heal: false, empower: 0, haste: 0, immortal: who});
  c.HEROES.alchemist.power = 0;
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
both('immortal-heroes', immortal('heroes'));
both('immortal-all', immortal('all'));
