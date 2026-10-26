// The whole game with Hail lasting 2 of its caster's turns (owner,
// 2026-10-25) against 1, after the Horse Archer's straight move and clear-shot
// AI: each starting ability removed from one side, the Storm Caller's
// upgrades (each joining its starting kit on both sides, one side without
// it), its speed and power, and every stage caravan against the full party
// (player wins).
const heroes = ['bokh', 'mangudai', 'storm'];
const turns = (n) => (c) => {
  c.ABILITY.hail.turns = n;
};
/** Hail lasting `n` turns, and the Storm Caller's kit Hail, `ability`, Hold. */
const withUpgrade = (n, ability) => (c) => {
  turns(n)(c);
  c.HEROES.storm.abilities = ['hail', ability, 'hold'];
};
export const experiments = Object.fromEntries(
  [1, 2].flatMap((n) => {
    const patch = turns(n);
    return [
      [`t${n}-control`, {patch, mod: {}}],
      ...['longshot', 'hail', 'grapple'].map((a) => [`t${n}-no-${a}`, {patch, mod: {ban: [a]}}]),
      ...['sunlight', 'gale'].flatMap((u) => [
        [`t${n}-${u}-no-${u}`, {patch: withUpgrade(n, u), mod: {ban: [u]}}],
        [`t${n}-${u}-no-hail`, {patch: withUpgrade(n, u), mod: {ban: ['hail']}}],
      ]),
      ...['speed', 'power'].map((s) => [`t${n}-storm-${s}+1`, {patch, mod: {stats: {storm: {[s]: 1}}}}]),
      ...heroes.map((h) => [`t${n}-vs-${h}+2wolves`, {patch, enemies: [h, 'wolf', 'wolf']}]),
      ...heroes.flatMap((a, i) =>
        heroes.slice(i).map((b) => [`t${n}-vs-${a}+${b}+wolf`, {patch, enemies: [a, b, 'wolf']}])
      ),
      [`t${n}-vs-all-three`, {patch, enemies: heroes}],
    ];
  })
);
