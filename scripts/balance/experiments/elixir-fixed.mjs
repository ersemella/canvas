// Elixir with a fixed Enhance and Degrade of 1 and a hit on an enemy
// (`ABILITY.elixir.fixed`), against the built Elixir (by power, no damage).
// *Seat*: the Alchemist in the Storm Caller's seat against the three Steppe
// heroes (`modWinPct`, 50% its equal); at power 2 as built and power 1.
// *China*: the fox, Vanguard and Alchemist against the Steppe party on the
// Gobi (`playerWinPct`, lower a stronger enemy).
const seat = ['bokh', 'mangudai', 'alchemist'];
const fixed = (c) => Object.assign(c.ABILITY.elixir, {fixed: 1});
export const experiments = {
  'seat-built': {mod: {party: seat}},
  'seat-fixed': {patch: fixed, mod: {party: seat}},
  'seat-fixed-power1': {patch: fixed, mod: {party: seat, stats: {alchemist: {power: -1}}}},
  'china-built': {enemies: ['fox', 'modao', 'alchemist'], map: 'gobi'},
  'china-fixed': {patch: fixed, enemies: ['fox', 'modao', 'alchemist'], map: 'gobi'},
};

// Elixir that also heals an ally the Alchemist's power (`ABILITY.elixir.heal`):
// any ally (`all`, the camel too) or heroes only, at power 2 and power 1.
const heals = (heal) => (c) => Object.assign(c.ABILITY.elixir, {fixed: 1, heal});
for (const heal of ['all', 'heroes']) {
  experiments[`seat-heal-${heal}`] = {patch: heals(heal), mod: {party: seat}};
  experiments[`seat-heal-${heal}-power1`] = {
    patch: heals(heal),
    mod: {party: seat, stats: {alchemist: {power: -1}}},
  };
  experiments[`china-heal-${heal}`] = {
    patch: heals(heal),
    enemies: ['fox', 'modao', 'alchemist'],
    map: 'gobi',
  };
}
