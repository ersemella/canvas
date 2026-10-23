// Volley (owner, 2026-10-23): arrows from above on one space within
// `ABILITY.volley.range` (3 when first measured, 2 as adopted), no line of
// fire, the bow's damage. Each ability removed from one side.
const abilities = ['bow', 'volley', 'hail', 'grapple', 'throw'];
export const experiments = {
  control: {mod: {}},
  ...Object.fromEntries(abilities.map((id) => [`no-${id}`, {mod: {ban: [id]}}])),
  'no-bow-volley': {mod: {ban: ['bow', 'volley']}},
};
