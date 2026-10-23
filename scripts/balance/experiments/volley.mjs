// Volley (owner, 2026-10-23) in place of Overwatch: arrows from above on one
// space within 3, no line of fire, the bow's damage. Each ability removed
// from one side; Fog stays in the Storm Caller's kit.
const abilities = ['bow', 'volley', 'hail', 'fog', 'grapple', 'throw'];
export const experiments = {
  control: {mod: {}},
  ...Object.fromEntries(abilities.map((id) => [`no-${id}`, {mod: {ban: [id]}}])),
  'no-bow-volley': {mod: {ban: ['bow', 'volley']}},
};
