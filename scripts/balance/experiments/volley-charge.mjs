// A charged Volley at range 3 (2026-10-23; charges 1, 2, 4 and 6; 2 adopted):
// the Horse Archer's card goes `ABILITY.volley.charge` more slots on after
// a volley, so its arrows land later, at its next turn, and it waits for
// them. Each charge with each ability removed from one side, and the stage
// caravans that bring an Horse Archer (player wins).
const charges = [1, 2, 4, 6];
const abilities = ['bow', 'volley', 'hail', 'grapple', 'throw'];
const caravans = {
  'mangudai+2wolves': ['mangudai', 'wolf', 'wolf'],
  'bokh+mangudai+wolf': ['bokh', 'mangudai', 'wolf'],
  'mangudai+storm+wolf': ['mangudai', 'storm', 'wolf'],
  'mangudai+mangudai+wolf': ['mangudai', 'mangudai', 'wolf'],
  'all-three': ['bokh', 'mangudai', 'storm'],
};
export const experiments = Object.fromEntries(
  charges.flatMap((charge) => {
    const patch = (c) => {
      c.ABILITY.volley.range = 3;
      c.ABILITIES.volley.range = 3;
      c.ABILITY.volley.charge = charge;
    };
    return [
      [`charge${charge}:control`, {patch, mod: {}}],
      ...abilities.map((id) => [`charge${charge}:no-${id}`, {patch, mod: {ban: [id]}}]),
      [`charge${charge}:no-bow-volley`, {patch, mod: {ban: ['bow', 'volley']}}],
      ...Object.entries(caravans).map(([c, enemies]) => [
        `charge${charge}:vs-${c}`,
        {patch, enemies},
      ]),
    ];
  })
);
