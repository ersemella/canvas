// A card Hastened or Delayed winning the collision where it lands (built,
// 2026-10-26) against its colliding by speed as any placement
// (`RULES.delayWins` and `.hasteWins` off), or a Delayed card still winning
// and only a Hastened one colliding by speed (`haste-by-speed`): China for the Steppe, each Chinese hero in its
// role's Steppe seat (50% its equal), and stage caravans against the Steppe
// party and camel (`playerWinPct`; lower, a stronger enemy).
const steppe = ['bokh', 'mangudai', 'storm'];
const china = ['youxia', 'modao', 'alchemist'];
const roles = {modao: 'bokh', youxia: 'mangudai', alchemist: 'storm'};
const variants = {
  built: () => {},
  'by-speed': (c) => {
    c.RULES.delayWins = false;
    c.RULES.hasteWins = false;
  },
  'haste-by-speed': (c) => void (c.RULES.hasteWins = false),
};
const caravans = {
  'china-party': china,
  'swordsman+vanguard+wolf': ['youxia', 'modao', 'wolf'],
  'all-three-steppe': steppe,
};
export const experiments = {};
for (const [name, patch] of Object.entries(variants)) {
  experiments[`${name}-party`] = {patch, mod: {party: china}};
  for (const [hero, seat] of Object.entries(roles))
    experiments[`${name}-${hero}-for-${seat}`] = {
      patch,
      mod: {party: steppe.map((h) => (h === seat ? hero : h))},
    };
  for (const [caravan, enemies] of Object.entries(caravans))
    experiments[`${name}-vs-${caravan}`] = {patch, enemies};
}
