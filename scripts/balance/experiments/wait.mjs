// Wait (2026-10-30; `RULES.waitShare`): a turn that does nothing (a Hold
// without a walk, or a turn skipped with only Hold to choose) sends the
// card a share of its action cost on, rounded. Measured two ways:
// - one side only, as Patient (`RULES.patientSlots`) on every one of its
//   units with Wait off: at 2/3 a Wait saves 3 slots at speeds 1 to 3, so
//   `p3-<region>` is Wait at 2/3 for one side of that region's mirror,
//   `p4-` at about 1/2; `deep-` gives that side a horizon of four
//   decisions and four times the work, against `deep-none-` with the same
//   search and no Wait, so a stronger player's use of it shows;
// - both sides, `built-` against `wait-` (2/3): the four regions' parties
//   against each other, and the fights' length and share of Holds.
const regions = {
  steppe: ['bokh', 'mangudai', 'storm'],
  china: ['modao', 'youxia', 'alchemist'],
  persia: ['mahout', 'archer', 'magus'],
  byzantium: ['cataphract', 'varangian', 'priest'],
};
const patient = (party) => Object.fromEntries(party.map((h) => [h, ['patient']]));
const slots = (n) => (c) => {
  c.RULES.patientSlots = n;
};
const deep = {depth: 4, work: 4 * 220};
export const experiments = {};
for (const [name, party] of Object.entries(regions)) {
  experiments[`p3-${name}`] = {patch: slots(3), party, mod: {passives: patient(party)}};
  experiments[`p4-${name}`] = {patch: slots(4), party, mod: {passives: patient(party)}};
  experiments[`deep-p3-${name}`] = {
    patch: slots(3),
    party,
    mod: {passives: patient(party), search: deep},
  };
  experiments[`deep-none-${name}`] = {party, mod: {search: deep}};
}
const both = {
  built: undefined,
  wait: (c) => {
    c.RULES.waitShare = 2 / 3;
  },
};
const names = Object.keys(regions);
for (const [mode, patch] of Object.entries(both)) {
  for (const [name, party] of Object.entries(regions))
    experiments[`${mode}-${name}`] = {patch, party};
  for (const [i, a] of names.entries())
    for (const b of names.slice(i + 1))
      experiments[`${mode}-${b}-vs-${a}`] = {patch, party: regions[a], mod: {party: regions[b]}};
}
