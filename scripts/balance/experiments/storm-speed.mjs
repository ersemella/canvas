// The Storm Caller at speed 3 (from 2), Hail untouched, on the current rules
// (two hails, hail on entry, the burst Elixir). *Seat*: a Chinese hero in the
// Storm Caller's seat against the three Steppe heroes (`modWinPct`; 50% its
// equal, lower a stronger Storm Caller). Each at speed 2 and 3.
const steppe = ['bokh', 'mangudai', 'storm'];
const china = ['youxia', 'modao', 'alchemist'];
const speed = (n) => (c) => {
  c.HEROES.storm.speed = n;
};
export const experiments = {
  // Head to head in a Steppe mirror: one side's Storm Caller 1 faster.
  'storm-speed+1': {mod: {stats: {storm: {speed: 1}}}},
};
for (const n of [2, 3]) {
  const patch = speed(n);
  for (const hero of china)
    experiments[`s${n}-${hero}-for-storm`] = {
      patch,
      mod: {party: steppe.map((h) => (h === 'storm' ? hero : h))},
    };
  experiments[`s${n}-china-for-steppe`] = {patch, mod: {party: china}};
  experiments[`s${n}-no-hail`] = {patch, mod: {ban: ['hail']}};
  experiments[`s${n}-vs-all-three`] = {patch, enemies: steppe};
  experiments[`s${n}-vs-storm+storm+wolf`] = {patch, enemies: ['storm', 'storm', 'wolf']};
  experiments[`s${n}-vs-bokh+storm+wolf`] = {patch, enemies: ['bokh', 'storm', 'wolf']};
}
