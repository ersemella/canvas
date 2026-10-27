// The Storm Caller at power 2 (from 1), so Hail hits for 2 on landing and on
// entry, on the current rules. *Seat*: another hero in the Storm Caller's
// seat against the three Steppe heroes (`modWinPct`; 50% its equal, lower a
// stronger Storm Caller). Each at power 1 and 2.
const steppe = ['bokh', 'mangudai', 'storm'];
const power = (n) => (c) => {
  c.HEROES.storm.power = n;
};
const seat = (from, hero) => steppe.map((h) => (h === from ? hero : h));
export const experiments = {
  // Head to head in a Steppe mirror: one side's Storm Caller 1 stronger.
  'storm-power+1': {mod: {stats: {storm: {power: 1}}}},
};
for (const n of [1, 2]) {
  const patch = power(n);
  for (const hero of ['youxia', 'modao', 'bokh', 'mangudai'])
    experiments[`p${n}-${hero}-for-storm`] = {patch, mod: {party: seat('storm', hero)}};
  experiments[`p${n}-modao-for-bokh`] = {patch, mod: {party: seat('bokh', 'modao')}};
  experiments[`p${n}-youxia-for-mangudai`] = {patch, mod: {party: seat('mangudai', 'youxia')}};
  experiments[`p${n}-no-hail`] = {patch, mod: {ban: ['hail']}};
  experiments[`p${n}-vs-storm+wolf+wolf`] = {patch, enemies: ['storm', 'wolf', 'wolf']};
  experiments[`p${n}-vs-bokh+storm+wolf`] = {patch, enemies: ['bokh', 'storm', 'wolf']};
  experiments[`p${n}-vs-mangudai+storm+wolf`] = {patch, enemies: ['mangudai', 'storm', 'wolf']};
  experiments[`p${n}-vs-storm+storm+wolf`] = {patch, enemies: ['storm', 'storm', 'wolf']};
  experiments[`p${n}-vs-all-three`] = {patch, enemies: steppe};
}
