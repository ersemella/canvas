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
const cards = [
  'steadyGait', 'secondWind', 'patient', 'momentum', 'rooted', 'lightStep', 'rebound',
  'hardened', 'lastStand', 'piercingEye', 'opportunist', 'bulwark', 'glassCannon',
  'ironWill', 'shakeLoose', 'flanker', 'loneWolf', 'rally', 'vengeance',
  'wearying', 'lethargy', 'inspire', 'fervour', 'forceful', 'reelIn', 'staggering',
  'hamstring', 'concussive', 'sundering', 'crippling', 'lockdown', 'defyFate',
  'immovableObject', 'invigorate', 'quickening', 'fortify', 'ward', 'mendingStrike',
  'mendingShot', 'forked',
];
export const experiments = {};
for (const [region, party] of Object.entries(regions))
  for (const hero of party) {
    for (const stat of ['speed', 'defence', 'power'])
      experiments[`${region}-${hero}-${stat}+1`] = {party, mod: {stats: {[hero]: {[stat]: 1}}}};
    for (const card of cards)
      experiments[`${region}-${hero}-${card}`] = {party, mod: {passives: {[hero]: [card]}}};
  }
