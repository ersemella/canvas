// The pared-back rules (owner, 2026-10-22): each ability of the three
// heroes' kits removed from one side, one at a time, to see what it is
// worth. Kits: Horse Archer Bow; Storm Caller Hail; Grappler Grapple and
// Throw. Every fight has the camel walking itself to the exit.
const abilities = ['bow', 'hail', 'grapple', 'throw'];
export const experiments = {
  control: {mod: {}},
  ...Object.fromEntries(abilities.map((id) => [`no-${id}`, {mod: {ban: [id]}}])),
};
