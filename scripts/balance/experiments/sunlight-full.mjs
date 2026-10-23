// Sunlight as it plays (Enhance 2, self, melts, squeeze; the AI counting
// half an Enhance's worth), against the Storm Caller with Hail alone, on
// the same rules (2026-10-23): each ability removed from one side, and
// every stage caravan against the full party.
const heroes = ['bokh', 'mangudai', 'storm'];
const caravans = {
  ...Object.fromEntries(heroes.map((h) => [`${h}+2wolves`, [h, 'wolf', 'wolf']])),
  ...Object.fromEntries(
    heroes.flatMap((a, i) => heroes.slice(i).map((b) => [`${a}+${b}+wolf`, [a, b, 'wolf']]))
  ),
  'all-three': heroes,
};
const kits = {
  sunlight: undefined,
  'hail-alone': ({HEROES}) => {
    HEROES.storm.abilities = ['hail', 'hold'];
  },
};
const bans = ['sunlight', 'hail', 'grapple', 'throw', 'bow', 'volley'];
export const experiments = {};
for (const [kit, patch] of Object.entries(kits)) {
  experiments[`${kit}:control`] = {patch, mod: {}};
  for (const id of bans)
    if (kit === 'sunlight' || id !== 'sunlight')
      experiments[`${kit}:no-${id}`] = {patch, mod: {ban: [id]}};
  experiments[`${kit}:mirror`] = {patch};
  for (const [name, enemies] of Object.entries(caravans))
    experiments[`${kit}:vs-${name}`] = {patch, enemies};
}
