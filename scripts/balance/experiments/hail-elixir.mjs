// Hail and Elixir as core abilities (2026-10-26), each by its switches.
// Hail: two hails standing at once (`ABILITY.hail.max`), and a unit that
// enters hail taking the caster's power (`entry`). Elixir: the Alchemist at
// power 0, every unit next to it (an aura of 1), an ally Empowered 2 and an
// enemy Weakened 1, no hit or heal (`empower`, `weaken`); and the same
// amounts as a burst of 1 on a space next to it.
// *Seat*: a Chinese hero in the Storm Caller's seat against the three Steppe
// heroes (`modWinPct`; lower, a stronger Storm Caller). *Alchemist seats*:
// the Alchemist in each Steppe hero's seat (50% that hero's equal).
const steppe = ['bokh', 'mangudai', 'storm'];
const china = ['youxia', 'modao', 'alchemist'];
const seat = (hero, out) => ({party: steppe.map((h) => (h === out ? hero : h))});

const hailVariants = {
  built: {},
  two: {max: 2},
  entry: {entry: true},
  'two-entry': {max: 2, entry: true},
};
const hail = (v) => (c) => Object.assign(c.ABILITY.hail, {max: 1, entry: false, ...v});

const elixirVariants = {
  // The single-unit Elixir, built until the burst replaced it (2026-10-26).
  built: (c) => {
    Object.assign(c.ABILITY.elixir, {
      shape: 'unit',
      range: 2,
      fixed: 1,
      heal: 'all',
      empower: 0,
      weaken: 0,
    });
    c.HEROES.alchemist.power = 1;
  },
  aura: (c) => {
    Object.assign(c.ABILITY.elixir, {
      shape: 'aura',
      radius: 1,
      fixed: 0,
      heal: false,
      empower: 2,
      weaken: 1,
    });
    c.HEROES.alchemist.power = 0;
  },
  burst: (c) => {
    Object.assign(c.ABILITY.elixir, {
      shape: 'burst',
      range: 1,
      radius: 1,
      fixed: 0,
      heal: false,
      empower: 2,
      weaken: 1,
    });
    c.HEROES.alchemist.power = 0;
  },
};

export const experiments = {};
for (const [name, v] of Object.entries(hailVariants)) {
  const patch = hail(v);
  experiments[`hail-${name}-no-hail`] = {patch, mod: {ban: ['hail']}};
  for (const hero of china)
    experiments[`hail-${name}-${hero}-for-storm`] = {patch, mod: seat(hero, 'storm')};
  experiments[`hail-${name}-vs-all-three`] = {patch, enemies: steppe};
  experiments[`hail-${name}-vs-storm+storm+wolf`] = {patch, enemies: ['storm', 'storm', 'wolf']};
  experiments[`hail-${name}-china-for-steppe`] = {patch, mod: {party: china}};
}
for (const [name, patch] of Object.entries(elixirVariants)) {
  for (const out of steppe)
    experiments[`elixir-${name}-alchemist-for-${out}`] = {patch, mod: seat('alchemist', out)};
  experiments[`elixir-${name}-china-for-steppe`] = {patch, mod: {party: china}};
}
