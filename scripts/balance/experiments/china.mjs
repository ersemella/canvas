// The China line-up (the test stage's: a fox spirit, the Modao Vanguard and
// the Waidan Alchemist) against the Steppe party (three heroes and the
// camel), on the Gobi and on the Steppe, beside the Steppe's own stages as
// references, and with each Chinese unit swapped for a fox to see what it
// adds. `playerWinPct` is the measure: lower means a stronger enemy.
const china = ['fox', 'modao', 'alchemist'];
export const experiments = {
  'china-gobi': {enemies: china, map: 'gobi'},
  'china-steppe': {enemies: china},
  'modao-as-fox-gobi': {enemies: ['fox', 'fox', 'alchemist'], map: 'gobi'},
  'alchemist-as-fox-gobi': {enemies: ['fox', 'modao', 'fox'], map: 'gobi'},
  'three-foxes-gobi': {enemies: ['fox', 'fox', 'fox'], map: 'gobi'},
  'steppe-stage1': {enemies: ['mangudai', 'wolf', 'wolf']},
  'steppe-stage3-gobi': {enemies: ['bokh', 'mangudai', 'storm'], map: 'gobi'},
};

// Hero for hero: each Chinese hero in place of each Steppe hero on one side
// (`mod.party`), the other side the three Steppe heroes, every seed played
// from both sides. `modWinPct` above 50% means the Chinese hero is the
// stronger in that seat.
const steppe = ['bokh', 'mangudai', 'storm'];
for (const hero of ['modao', 'alchemist'])
  for (const [i, out] of steppe.entries())
    experiments[`${hero}-for-${out}`] = {
      mod: {party: steppe.map((h, j) => (j === i ? hero : h))},
    };
experiments['modao+alchemist-for-bokh+storm'] = {mod: {party: ['modao', 'mangudai', 'alchemist']}};
