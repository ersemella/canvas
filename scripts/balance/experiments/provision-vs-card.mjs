// A provision against a passive or a generic ability upgrade (2026-10-29):
// in each region's mirror, one hero of the modified side takes +1 speed,
// defence or power (a provision) or one card of the caravanserai's pool
// (`PASSIVES`, passives and upgrades), the modified side's wins the measure.
const regions = {
  steppe: ['bokh', 'mangudai', 'storm'],
  china: ['modao', 'youxia', 'alchemist'],
  persia: ['mahout', 'archer', 'magus'],
  byzantium: ['cataphract', 'varangian', 'priest'],
};
// The pool since 2026-11-02 (owner): 22 cards out, Concussive in three tiers
// (Staggering folded in as I), six cards added, Unstoppable offered. The
// measurement of 2026-10-29 (balance.md) ran on the 40 of the time.
const cards = [
  'steadyGait', 'secondWind', 'patient', 'momentum', 'rooted', 'unstoppable', 'lightStep',
  'lastStand', 'opportunist', 'glassCannon', 'plated', 'braced', 'flanker', 'loneWolf',
  'sureHand', 'forceful', 'concussive1', 'concussive2', 'concussive3', 'sundering',
  'crippling', 'empowering', 'hastening', 'sheltering', 'forked',
];
export const experiments = {};
for (const [region, party] of Object.entries(regions))
  for (const hero of party) {
    for (const stat of ['speed', 'defence', 'power'])
      experiments[`${region}-${hero}-${stat}+1`] = {party, mod: {stats: {[hero]: {[stat]: 1}}}};
    for (const card of cards)
      experiments[`${region}-${hero}-${card}`] = {party, mod: {passives: {[hero]: [card]}}};
  }
