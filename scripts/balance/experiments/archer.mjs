// The Archer (2026-10-27: speed 2, defence 1, power 3, Longshot) in each
// seat of a Steppe mirror and of a China mirror, and in place of the other
// damage heroes: whether a power-3 shot nothing blocks is too strong to
// have. `modWinPct` throughout; the roster's spread was within about 3
// points of 50% (balance.md, "The roster checked again").
const steppe = ['bokh', 'mangudai', 'storm'];
const china = ['youxia', 'modao', 'alchemist'];
const seat = (party, i, hero) => party.map((h, j) => (j === i ? hero : h));
export const experiments = {};
for (const [name, party] of [
  ['steppe', steppe],
  ['china', china],
])
  for (const [i, out] of party.entries())
    experiments[`archer-for-${out}-${name}`] = {party, mod: {party: seat(party, i, 'archer')}};
