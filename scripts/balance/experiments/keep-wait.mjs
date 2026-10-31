// A Wait always searched (2026-10-31; `AI.keepWait`): a Hold in place that
// brings the card back sooner joins the options a decision searches on,
// the root's (`k1-`) or every decision's (`k2-`). Both sides with walks and
// the track priced alike (`reachShare`, `leafTrack` 0.25; reach.mjs's
// `waitm0.25-`, the same rows without it), production's search; one side
// with Wait at 2/3 (Patient 3). `kh-`: `k2-` with a horizon of 6 slots,
// searching up to 6 decisions, narrowing 4, 3, 2, four times the work
// (horizon.mjs's `h6-`, the same rows without it).
const regions = {
  steppe: ['bokh', 'mangudai', 'storm'],
  china: ['modao', 'youxia', 'alchemist'],
  persia: ['mahout', 'archer', 'magus'],
  byzantium: ['cataphract', 'varangian', 'priest'],
};
const patient = (party) => Object.fromEntries(party.map((h) => [h, ['patient']]));
const priced = (keep) => (c) => {
  c.AI.reachShare = 0.25;
  c.AI.leafTrack = 0.25;
  c.AI.keepWait = keep;
  c.RULES.patientSlots = 3;
};
export const experiments = {};
for (const [name, party] of Object.entries(regions)) {
  for (const k of [1, 2])
    experiments[`k${k}-${name}`] = {patch: priced(k), party, mod: {passives: patient(party)}};
  experiments[`kh-${name}`] = {
    patch: (c) => {
      priced(2)(c);
      c.AI.searchDepth = 6;
      c.AI.searchWidths = [4, 3, 2];
      c.AI.maxSimulations = 4 * 220;
      c.AI.horizonSlots = 6;
    },
    party,
    mod: {passives: patient(party)},
  };
}
