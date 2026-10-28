// Trample as a stomp (2026-10-28): the Juggernaut stays where it is, and every
// unit next to it, ally or enemy, takes its power and is Pushed 1 away
// (`ABILITY.trample.mode: 'stomp'`), against the charge as built (a walk of up
// to 2 in a line, the row in its way hit and Pushed back). For each: the
// Juggernaut in the tank seat of a Steppe and a China mirror, the Grappler and
// the Vanguard in its seat of Persia's party, Persia against the Steppe and
// China party for party, and skill, as roster-check.mjs: the Juggernaut
// played a decision deep or four deep in a Steppe mirror with one on each
// side. `modWinPct` throughout.
const steppe = ['bokh', 'mangudai', 'storm'];
const china = ['modao', 'youxia', 'alchemist'];
const persia = ['mahout', 'archer', 'magus'];
const seat = (party, i, hero) => party.map((h, j) => (j === i ? hero : h));
const novice = {depth: 1, work: 220};
const expert = {depth: 4, work: 4 * 220};
const modes = {
  charge: (c) => Object.assign(c.ABILITY.trample, {mode: 'charge', step: 0}),
  stomp: (c) => Object.assign(c.ABILITY.trample, {mode: 'stomp', step: 0}),
  // Added later that day: a step of 1 first, or none, then the stomp (`step`).
  'step-stomp': (c) => Object.assign(c.ABILITY.trample, {mode: 'stomp', step: 1}),
};
export const experiments = {};
for (const [m, patch] of Object.entries(modes)) {
  const add = (name, e) => (experiments[`${m}-${name}`] = {patch, ...e});
  add('mahout-for-bokh-steppe', {party: steppe, mod: {party: seat(steppe, 0, 'mahout')}});
  add('mahout-for-modao-china', {party: china, mod: {party: seat(china, 0, 'mahout')}});
  add('bokh-for-mahout-persia', {party: persia, mod: {party: seat(persia, 0, 'bokh')}});
  add('modao-for-mahout-persia', {party: persia, mod: {party: seat(persia, 0, 'modao')}});
  add('persia-vs-steppe', {party: steppe, mod: {party: persia}});
  add('persia-vs-china', {party: china, mod: {party: persia}});
  const party = seat(steppe, 0, 'mahout');
  for (const [level, search] of [
    ['novice', novice],
    ['expert', expert],
  ])
    add(`${level}-mahout`, {party, mod: {search, searchHeroes: ['mahout']}});
}
