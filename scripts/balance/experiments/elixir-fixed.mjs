// Elixir's amounts (2026-10-26), each variant setting `ABILITY.elixir` and
// the Alchemist's power in full, so it doesn't depend on the built values.
// *Seat*: the Alchemist in the Storm Caller's seat against the three Steppe
// heroes (`modWinPct`, 50% its equal). *China*: the fox, Vanguard and
// Alchemist against the Steppe party on the Gobi (`playerWinPct`, lower a
// stronger enemy).
const seat = ['bokh', 'mangudai', 'alchemist'];
const china = {enemies: ['fox', 'modao', 'alchemist'], map: 'gobi'};
const elixir =
  (power, {fixed = 0, heal = false, tempo = 0} = {}) =>
  (c) => {
    Object.assign(c.ABILITY.elixir, {fixed, heal, tempo});
    c.HEROES.alchemist.power = power;
  };
export const experiments = {
  // Empower and Weaken by power, no hit (the Elixir of 2026-10-25).
  'seat-built': {patch: elixir(2), mod: {party: seat}},
  'china-built': {patch: elixir(2), ...china},
  // Fixed 1 and a hit of the Alchemist's power.
  'seat-fixed': {patch: elixir(2, {fixed: 1}), mod: {party: seat}},
  'seat-fixed-power1': {patch: elixir(1, {fixed: 1}), mod: {party: seat}},
  'china-fixed': {patch: elixir(2, {fixed: 1}), ...china},
};

// And a heal of the Alchemist's power on allies: any ally (`all`, the camel
// too; built since 2026-10-26 at power 1) or heroes only.
for (const heal of ['all', 'heroes']) {
  experiments[`seat-heal-${heal}`] = {patch: elixir(2, {fixed: 1, heal}), mod: {party: seat}};
  experiments[`seat-heal-${heal}-power1`] = {
    patch: elixir(1, {fixed: 1, heal}),
    mod: {party: seat},
  };
  experiments[`china-heal-${heal}`] = {patch: elixir(2, {fixed: 1, heal}), ...china};
  // Everything by power at power 2: the Empower and Weaken 2 too.
  experiments[`seat-heal-${heal}-all-by-power2`] = {
    patch: elixir(2, {fixed: 2, heal}),
    mod: {party: seat},
  };
}

// No damage at power 0: an ally Empowered and Hastened, an enemy Weakened and
// Delayed, by fixed amounts (`fixed`, `tempo`), any unit a target.
for (const fixed of [1, 2])
  for (const tempo of [0, 3, 5]) {
    experiments[`seat-power0-fixed${fixed}-tempo${tempo}`] = {
      patch: elixir(0, {fixed, tempo}),
      mod: {party: seat},
    };
    experiments[`china-power0-fixed${fixed}-tempo${tempo}`] = {
      patch: elixir(0, {fixed, tempo}),
      ...china,
    };
  }

// The built Elixir in the China line-up at power 1.
experiments['china-built-2026-10-26'] = {patch: elixir(1, {fixed: 1, heal: 'all'}), ...china};
