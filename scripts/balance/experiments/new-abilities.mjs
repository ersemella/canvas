// The new abilities of 2026-10-23 (owner): Overwatch for the Outrider,
// Sunlight for the Storm Caller, and Throw's swap landing for the Champion.
// Each ability removed from one side, one at a time, as in pared.mjs, and
// both new ones together (the kits before them, Throw's swap aside). The
// swap can't be removed on its own: it is one of Throw's landings.
const abilities = ['bow', 'overwatch', 'hail', 'sunlight', 'grapple', 'throw'];
export const experiments = {
  control: {mod: {}},
  ...Object.fromEntries(abilities.map((id) => [`no-${id}`, {mod: {ban: [id]}}])),
  'no-overwatch-sunlight': {mod: {ban: ['overwatch', 'sunlight']}},
};
