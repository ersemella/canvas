// Wait in runs (2026-10-31): Wait at 2/3 (`RULES.waitShare`), and the AI
// that plays it, walks and the track priced alike (`AI.reachShare`,
// `AI.leafTrack` 0.25) with near-ties settled by the turn's own worth
// (`AI.tieMargin`), as built, against the game before (`before-`: all
// four off). The four regions' mirrors (the player side's win rate, the
// side bias) and parties against each other (`modWinPct`); and `ai-`: the
// AI as built against the AI before, on today's rules, one side each.
const regions = {
  steppe: ['bokh', 'mangudai', 'storm'],
  china: ['modao', 'youxia', 'alchemist'],
  persia: ['mahout', 'archer', 'magus'],
  byzantium: ['cataphract', 'varangian', 'priest'],
};
const before = (c) => {
  c.RULES.waitShare = 1;
  c.AI.reachShare = 0;
  c.AI.leafTrack = 0;
  c.AI.tieMargin = 0;
};
const modes = {before, built: undefined};
const names = Object.keys(regions);
export const experiments = {};
for (const [mode, patch] of Object.entries(modes)) {
  for (const [name, party] of Object.entries(regions))
    experiments[`${mode}-${name}`] = {patch, party};
  for (const [i, a] of names.entries())
    for (const b of names.slice(i + 1))
      experiments[`${mode}-${b}-vs-${a}`] = {patch, party: regions[a], mod: {party: regions[b]}};
}
for (const [name, party] of Object.entries(regions))
  experiments[`ai-${name}`] = {
    party,
    patch: (c) => {
      c.AI.reachShare = 0;
      c.AI.leafTrack = 0;
      c.AI.tieMargin = 0;
    },
    mod: {ai: {reachShare: 0.25, leafTrack: 0.25, tieMargin: 0.05}},
  };
