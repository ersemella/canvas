// Each ability removed from one side, one at a time: what is it worth?
const abilities = ['bow', 'leap', 'volley', 'throw', 'pin', 'lunge', 'sunlight', 'hail', 'freeze'];
export const experiments = {
  control: {mod: {}},
  ...Object.fromEntries(abilities.map((id) => [`no-${id}`, {mod: {ban: [id]}}])),
};
