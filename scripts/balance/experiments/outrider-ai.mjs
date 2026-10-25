// The AI with the Outrider's straight move (2026-10-25; balance.md): its
// closing-in reward (`AI.perHexFromEnemy`) grows with the move's length, so
// the Outrider dashed into melee. Variants: a standoff below which closing in
// earns nothing (`AI.standoff`), more caution, and the walk of 2 for
// reference. Each with the Bow removed from one side, and the full party
// against all three heroes.
const variants = {
  today: () => {},
  walk2: (c) => {
    c.HEROES.mangudai.movesStraight = false;
  },
  standoff2: (c) => {
    c.AI.standoff.mangudai = 2;
  },
  standoff3: (c) => {
    c.AI.standoff.mangudai = 3;
  },
  standoff4: (c) => {
    c.AI.standoff.mangudai = 4;
  },
  caution2: (c) => {
    c.AI.caution.mangudai = 2;
  },
  standoff3caution2: (c) => {
    c.AI.standoff.mangudai = 3;
    c.AI.caution.mangudai = 2;
  },
};
const heroes = ['bokh', 'mangudai', 'storm'];
export const experiments = Object.fromEntries(
  Object.entries(variants).flatMap(([name, patch]) => [
    [`${name}-no-longshot`, {patch, mod: {ban: ['longshot']}}],
    [`${name}-vs-all-three`, {patch, enemies: heroes}],
  ])
);
