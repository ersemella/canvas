// The Horse Archer's AI, second round (2026-10-25; balance.md): closing in by
// lining up a shot (`AI.linesUp`: the steps onto one of the target's six
// lines, not the spaces to it; `AI.clearShot`: only a line with a clear
// shot down it), with the straight move and the walk of 2.
const variants = {
  linesUpClear: (c) => {
    c.AI.linesUp = true;
    c.AI.clearShot = true;
  },
  linesUpClearWalk2: (c) => {
    c.AI.linesUp = true;
    c.AI.clearShot = true;
    c.HEROES.mangudai.movesStraight = false;
  },
  linesUp: (c) => {
    c.AI.linesUp = true;
  },
  linesUpWalk2: (c) => {
    c.AI.linesUp = true;
    c.HEROES.mangudai.movesStraight = false;
  },
  linesUpCaution2: (c) => {
    c.AI.linesUp = true;
    c.AI.caution.mangudai = 2;
  },
};
const heroes = ['bokh', 'mangudai', 'storm'];
export const experiments = Object.fromEntries(
  Object.entries(variants).flatMap(([name, patch]) => [
    [`${name}-no-snapShot`, {patch, mod: {ban: ['snapShot']}}],
    [`${name}-vs-all-three`, {patch, enemies: heroes}],
  ])
);
