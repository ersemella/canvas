// +1 of each stat (and +2 health, for reference: what +1 defence gives) on
// one hero of one side: the exchange rates between stats (2026-10-23 scale).
const heroes = ['bokh', 'mangudai', 'storm'];
const extras = {speed: 1, defence: 1, power: 1, hp: 2};
export const experiments = Object.fromEntries(
  heroes.flatMap((hero) =>
    Object.entries(extras).map(([stat, n]) => [
      `${hero}-${stat}+${n}`,
      {mod: {stats: {[hero]: {[stat]: n}}}},
    ])
  )
);
