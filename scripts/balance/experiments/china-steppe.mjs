// The China party (Swordsman, Vanguard, Alchemist)
// against the Steppe party (Grappler, Horse Archer, Storm Caller)
// on the current rules, and each Chinese hero in each Steppe hero's seat.
// `mod` experiments: `modWinPct` is the modified side's share of finished
// fights, every seed played from both sides, the camel with the player.
const steppe = ['bokh', 'mangudai', 'storm'];
const china = ['youxia', 'modao', 'alchemist'];
export const experiments = {
  // Party for party: one side China, the other the Steppe.
  'china-for-steppe': {mod: {party: china}},
  'china-for-steppe-gobi': {mod: {party: china}, map: 'gobi'},
  // As a stage: the Steppe party and camel against the three Chinese heroes,
  // and the China party and camel against the three Steppe heroes.
  'steppe-vs-china-enemy-gobi': {enemies: china, map: 'gobi'},
  'china-vs-steppe-enemy-gobi': {party: china, enemies: steppe, map: 'gobi'},
};
// Hero for hero in a Steppe mirror; the Swordsman for the Horse Archer is the
// damage hero for the damage hero.
for (const hero of china)
  for (const [i, out] of steppe.entries())
    experiments[`${hero}-for-${out}`] = {
      mod: {party: steppe.map((h, j) => (j === i ? hero : h))},
    };
