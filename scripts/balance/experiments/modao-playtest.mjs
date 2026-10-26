// The Vanguard after the first playtest (owner, 2026-10-22): Hold the
// Line, Reap a cone with Push 3, Advance a charge of up to 3, Barrier 40.
// Run against the kit it replaced (a worktree of the commit before) for the
// comparison in balance.md. Hold the Line acts on the other side's turns,
// so a one-sided ban can't remove it; it isn't ablated here.
const team = ['modao', 'mangudai', 'storm'];
const kit = ['reap', 'challenge', 'advance'];
export const experiments = {
  // The Vanguard's team against the prototype party: Vanguard against Grappler as the tank.
  'modao-for-bokh': {mod: {party: team}},
  // The Vanguard mirror: its usage and damage.
  control: {party: team, mod: {}},
  // Each ability removed from one side's Vanguard: what is it worth?
  ...Object.fromEntries(kit.map((id) => [`no-${id}`, {party: team, mod: {ban: [id]}}])),
};
