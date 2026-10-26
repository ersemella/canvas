// The China mirror: the China party (Swordsman, Vanguard, Alchemist) on both
// sides, the camel with the player, and each Chinese hero swapped for each
// Steppe hero on one side. `modWinPct` is the swapped side's share, every
// seed played from both sides: above 50%, the hero taken out was the weaker.
const china = ['youxia', 'modao', 'alchemist'];
const steppe = ['bokh', 'mangudai', 'storm'];
export const experiments = {mirror: {party: china}};
for (const [i, out] of china.entries())
  for (const hero of steppe)
    experiments[`${hero}-for-${out}`] = {
      party: china,
      mod: {party: china.map((h, j) => (j === i ? hero : h))},
    };
