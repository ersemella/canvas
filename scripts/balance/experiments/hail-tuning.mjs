// Scaling Hail down (2026-10-23): each part of it lowered on its own, then
// together, both sides. Measured against the full party by the enemy
// Hail favours most (two Storm Callers and a wolf) and by stage 3's (all
// three heroes): the player's win rate rises as Hail weakens.
const variants = {
  current: {},
  'land-20': {damage: 20},
  'land-0': {damage: 0},
  'linger-10': {turnDamage: 10},
  'linger-0': {turnDamage: 0},
  'slots-10': {hexSlots: 10},
  'push-3': {castPush: 3},
  'range-2': {range: 2},
  'land-20+linger-10': {damage: 20, turnDamage: 10},
  'land-20+slots-10': {damage: 20, hexSlots: 10},
};
const enemies = {
  storms: ['storm', 'storm', 'wolf'],
  all: ['bokh', 'mangudai', 'storm'],
};
export const experiments = Object.fromEntries(
  Object.entries(variants).flatMap(([name, hail]) =>
    Object.entries(enemies).map(([e, units]) => [
      `${name}/${e}`,
      {
        enemies: units,
        patch: (c) => {
          Object.assign(c.ABILITY.hail, hail);
          if (hail.range !== undefined) c.ABILITIES.hail.range = hail.range;
        },
      },
    ])
  )
);
