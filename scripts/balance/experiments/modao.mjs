// The Modao Vanguard (roster.md, 15.8), being balanced before it joins the
// party. Its team is the Vanguard with the Outrider and the Storm Caller.
const team = ['modao', 'mangudai', 'storm'];
const kit = ['reap', 'challenge', 'advance'];
export const experiments = {
  // The Vanguard's team against the prototype party: Vanguard against Champion as the tank.
  'modao-for-bokh': {mod: {party: team}},
  // The Vanguard mirror: a sanity check, and its usage and damage.
  control: {party: team, mod: {}},
  // Each ability removed from one side's Vanguard: what is it worth?
  ...Object.fromEntries(kit.map((id) => [`no-${id}`, {party: team, mod: {ban: [id]}}])),
  // High health (540) instead of Medium (420), as the roster first had it.
  'modao-hp+120': {party: team, mod: {stats: {modao: {hp: 120}}}},
};
