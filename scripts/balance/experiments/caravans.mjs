// Enemy caravans against the full player party (three heroes and the camel):
// each hero alone with two wolves (stage 1's shape), and each pair with a
// wolf (stage 2's), to compare solo strength and pair synergy. The
// same-hero pairs are a reference: a pair beating both of its doubles is
// more than the sum of its parts. `playerWinPct` is the measure: lower
// means a stronger enemy.
const heroes = ['bokh', 'mangudai', 'storm'];
export const experiments = {
  ...Object.fromEntries(heroes.map((h) => [`${h}+2wolves`, {enemies: [h, 'wolf', 'wolf']}])),
  ...Object.fromEntries(
    heroes.flatMap((a, i) =>
      heroes.slice(i).map((b) => [`${a}+${b}+wolf`, {enemies: [a, b, 'wolf']}])
    )
  ),
  'all-three': {enemies: heroes},
};
