// Each ability removed from one side, one at a time: what is it worth?
// The fog weights stand in for the AI fix the 2026-10-20 review proposed
// (docs/plans/roguelike-tactics/balance.md); drop `patch` to measure the AI as it is.
const fogFix = ({AI}) => {
  AI.fogShield = 24_000;
  AI.fogBlind = 100;
};
const abilities = [
  'bow',
  'leap',
  'volley',
  'throw',
  'pin',
  'rampage',
  'sunlight',
  'hail',
  'fog',
  'freeze',
];
export const experiments = {
  control: {patch: fogFix, mod: {}},
  ...Object.fromEntries(abilities.map((id) => [`no-${id}`, {patch: fogFix, mod: {ban: [id]}}])),
};
