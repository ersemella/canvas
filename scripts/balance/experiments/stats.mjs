// +10 of each stat (and +60 health, for reference) on one hero of one side:
// the exchange rates between stats.
const heroes = ['bokh', 'mangudai', 'storm'];
const extras = {speed: 10, defence: 10, power: 10, hp: 60};
export const experiments = Object.fromEntries(
  heroes.flatMap((hero) =>
    Object.entries(extras).map(([stat, n]) => [
      `${hero}-${stat}+${n}`,
      {mod: {stats: {[hero]: {[stat]: n}}}},
    ])
  )
);
