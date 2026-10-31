// A horizon of slots (2026-10-31; `AI.horizonSlots`): a line of the search
// ends once the track is that far past the root, so a line that Waits sees
// as much of the track as one that acts. Both sides search deeper for it
// (up to 6 decisions, narrowing 4, 3, 2, four times the work) with walks
// and the track priced alike (`reachShare`, `leafTrack` 0.25; reach.mjs's
// `waitm0.25-`). `d6-<region>`: one side with Wait at 2/3 (Patient 3), the
// search cut by decisions only; `h<slots>-`: the same with the horizon;
// `ai-h6-`: no Wait, one side's AI with the horizon (is it better?).
const regions = {
  steppe: ['bokh', 'mangudai', 'storm'],
  china: ['modao', 'youxia', 'alchemist'],
  persia: ['mahout', 'archer', 'magus'],
  byzantium: ['cataphract', 'varangian', 'priest'],
};
const patient = (party) => Object.fromEntries(party.map((h) => [h, ['patient']]));
const search = (horizon) => (c) => {
  c.AI.reachShare = 0.25;
  c.AI.leafTrack = 0.25;
  c.AI.searchDepth = 6;
  c.AI.searchWidths = [4, 3, 2];
  c.AI.maxSimulations = 4 * 220;
  c.AI.horizonSlots = horizon;
  c.RULES.patientSlots = 3;
};
export const experiments = {};
for (const [name, party] of Object.entries(regions)) {
  experiments[`d6-${name}`] = {patch: search(0), party, mod: {passives: patient(party)}};
  for (const h of [6, 9])
    experiments[`h${h}-${name}`] = {patch: search(h), party, mod: {passives: patient(party)}};
  experiments[`ai-h6-${name}`] = {patch: search(0), party, mod: {ai: {horizonSlots: 6}}};
}
