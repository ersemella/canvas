// The search's leaf counting the track (2026-10-30; `AI.leafTrack`), and
// Wait measured again with it. `leaf<w>-<region>`: one side's AI with the
// term at weight w, the other's without, built rules (is the AI better
// for it?). `wait<w>-<region>`: both sides' AI with it, one side with Wait
// at 2/3, given as Patient 3 with Wait off (as wait.mjs's `p3-`).
const regions = {
  steppe: ['bokh', 'mangudai', 'storm'],
  china: ['modao', 'youxia', 'alchemist'],
  persia: ['mahout', 'archer', 'magus'],
  byzantium: ['cataphract', 'varangian', 'priest'],
};
const patient = (party) => Object.fromEntries(party.map((h) => [h, ['patient']]));
export const experiments = {};
for (const w of [0.5, 1])
  for (const [name, party] of Object.entries(regions)) {
    experiments[`leaf${w}-${name}`] = {party, mod: {ai: {leafTrack: w}}};
    experiments[`wait${w}-${name}`] = {
      patch: (c) => {
        c.AI.leafTrack = w;
        c.RULES.patientSlots = 3;
      },
      party,
      mod: {passives: patient(party)},
    };
  }
