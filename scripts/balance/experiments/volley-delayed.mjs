// A delayed Volley at range 3 (2026-10-23): the arrows land on the marked
// space at the start of the Outrider's next turn, on whoever stands there
// then (`ABILITY.volley.delayed`). Nothing else changed. Each ability
// removed from one side, and the stage caravans that bring an Outrider
// (player wins).
const patch = (c) => {
  c.ABILITY.volley.range = 3;
  c.ABILITIES.volley.range = 3;
  c.ABILITY.volley.delayed = true;
};
const abilities = ['bow', 'volley', 'hail', 'grapple', 'throw'];
const caravans = {
  'mangudai+2wolves': ['mangudai', 'wolf', 'wolf'],
  'bokh+mangudai+wolf': ['bokh', 'mangudai', 'wolf'],
  'mangudai+storm+wolf': ['mangudai', 'storm', 'wolf'],
  'mangudai+mangudai+wolf': ['mangudai', 'mangudai', 'wolf'],
  'all-three': ['bokh', 'mangudai', 'storm'],
};
export const experiments = {
  control: {patch, mod: {}},
  ...Object.fromEntries(abilities.map((id) => [`no-${id}`, {patch, mod: {ban: [id]}}])),
  'no-bow-volley': {patch, mod: {ban: ['bow', 'volley']}},
  ...Object.fromEntries(
    Object.entries(caravans).map(([c, enemies]) => [`vs-${c}`, {patch, enemies}])
  ),
};
