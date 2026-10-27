// A balance check of the whole roster on the rules of 2026-10-27 (Cleave a
// line of 2 six ways, the Elixir on one unit within 2 with Empower 2 and
// Weaken 2, the Storm Caller at power 2, the Steppe's mountains in every
// fight): whether any hero is strictly better to have than another, and how
// much each rewards being played well. `modWinPct` throughout.
const steppe = ['bokh', 'mangudai', 'storm'];
const china = ['youxia', 'modao', 'alchemist'];
const heroes = [...steppe, ...china];
const role = {bokh: 0, modao: 0, mangudai: 1, youxia: 1, storm: 2, alchemist: 2};
// Production's search is depth 3, 220 work a turn. A novice looks one
// decision ahead; an expert as mirror.ts's `deep`.
const novice = {depth: 1, work: 220};
const expert = {depth: 4, work: 4 * 220};
const seat = (party, i, hero) => party.map((h, j) => (j === i ? hero : h));
export const experiments = {
  'china-for-steppe': {mod: {party: china}},
};
// Every hero in every seat of a Steppe mirror and of a China mirror. Two
// Grapplers on one side crash the rules (balance.md, "The Storm Caller at
// power 2") and never meet in a run, so those seats are left out.
for (const [name, party] of [['steppe', steppe], ['china', china]])
  for (const hero of heroes)
    for (const [i, out] of party.entries()) {
      if (hero === out || (hero === 'bokh' && party.includes('bokh'))) continue;
      experiments[`${hero}-for-${out}-${name}`] = {party, mod: {party: seat(party, i, hero)}};
    }
// Skill: one hero played by a novice or an expert, the rest of both sides by
// production, in a Steppe mirror with that hero in its role's seat on both
// sides. The further its side falls from 50%, the more the hero rewards play.
for (const hero of heroes) {
  const party = seat(steppe, role[hero], hero);
  for (const [level, search] of [['novice', novice], ['expert', expert]])
    experiments[`${level}-${hero}`] = {party, mod: {search, searchHeroes: [hero]}};
}
// Skill, a whole side, in each region's mirror.
for (const [name, party] of [['steppe', steppe], ['china', china]])
  for (const [level, search] of [['novice', novice], ['expert', expert]])
    experiments[`${level}-${name}-party`] = {party, mod: {search}};
