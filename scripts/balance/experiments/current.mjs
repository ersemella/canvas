// The game as it plays (2026-10-23, after Skirmish was adopted): each
// ability of the kits removed from one side, the Outrider's two attacks
// together, and every stage caravan against the full party (player wins).
const heroes = ['bokh', 'mangudai', 'storm'];
const bans = [['bow'], ['skirmish'], ['hail'], ['sunlight'], ['grapple'], ['throw'], ['bow', 'skirmish']];
export const experiments = {
  control: {mod: {}},
  ...Object.fromEntries(bans.map((ban) => [`no-${ban.join('-')}`, {mod: {ban}}])),
  ...Object.fromEntries(heroes.map((h) => [`vs-${h}+2wolves`, {enemies: [h, 'wolf', 'wolf']}])),
  ...Object.fromEntries(
    heroes.flatMap((a, i) =>
      heroes.slice(i).map((b) => [`vs-${a}+${b}+wolf`, {enemies: [a, b, 'wolf']}])
    )
  ),
  'vs-all-three': {enemies: heroes},
};
