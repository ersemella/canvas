// Walks priced by the hit they set up (2026-10-31; `AI.reachShare`): the
// search's leaf counting each unit's best hit from where it stands, for
// its side and against the other. `reach<w>-<region>`: one side's AI with
// it at weight w, the other's production's, in each region's mirror (is
// the AI better for it?). `wait<w>-<region>`: both AIs with it and the
// track in the leaf (`AI.leafTrack` 1), one side with Wait at 2/3, given
// as Patient 3 (as wait.mjs's `p3-`).
const regions = {
  steppe: ['bokh', 'mangudai', 'storm'],
  china: ['modao', 'youxia', 'alchemist'],
  persia: ['mahout', 'archer', 'magus'],
  byzantium: ['cataphract', 'varangian', 'priest'],
};
const patient = (party) => Object.fromEntries(party.map((h) => [h, ['patient']]));
export const experiments = {};
for (const w of [0.25, 0.5, 1])
  for (const [name, party] of Object.entries(regions)) {
    experiments[`reach${w}-${name}`] = {party, mod: {ai: {reachShare: w}}};
    experiments[`wait${w}-${name}`] = {
      patch: (c) => {
        c.AI.reachShare = w;
        c.AI.leafTrack = 1;
        c.RULES.patientSlots = 3;
      },
      party,
      mod: {passives: patient(party)},
    };
  }
// `waitm<w>-<region>`: as `wait<w>-` with the track in the leaf at the
// same weight as reach (`AI.leafTrack` w), so a third of a turn saved and
// a hit set up are priced alike.
for (const w of [0.25, 0.5])
  for (const [name, party] of Object.entries(regions))
    experiments[`waitm${w}-${name}`] = {
      patch: (c) => {
        c.AI.reachShare = w;
        c.AI.leafTrack = w;
        c.RULES.patientSlots = 3;
      },
      party,
      mod: {passives: patient(party)},
    };
