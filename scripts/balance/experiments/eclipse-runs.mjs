// Eclipse in runs (owner, 2026-10-31): whole runs with the Magus in the
// party (Persia's three, and the Magus in the Steppe's support seat), as
// built (Eclipse) and with Omen back (a `patch`, both sides, Persia's
// stages' Magi too). A check that runs play through and how far they get.
const omen = (c) => {
  c.HEROES.magus.abilities = ['omen', 'hold'];
};
export const experiments = {
  'eclipse-persia': {party: ['mahout', 'archer', 'magus'], group: 'eclipse'},
  'omen-persia': {party: ['mahout', 'archer', 'magus'], patch: omen, group: 'omen'},
  'eclipse-steppe-magus': {party: ['bokh', 'mangudai', 'magus'], group: 'eclipse'},
  'omen-steppe-magus': {party: ['bokh', 'mangudai', 'magus'], patch: omen, group: 'omen'},
};
