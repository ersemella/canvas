// Fog on one space (owner, 2026-10-23), in place of Sunlight: each ability
// removed from one side, with the AI valuing Overwatch's lanes.
const abilities = ['bow', 'overwatch', 'hail', 'fog', 'grapple', 'throw'];
export const experiments = {
  control: {mod: {}},
  ...Object.fromEntries(abilities.map((id) => [`no-${id}`, {mod: {ban: [id]}}])),
};
