// Cleave as a line of 2 straight out in any of the six directions
// (`ABILITY.cleave.shape: 'lines'`, the shape before 2026-10-26) against the
// built shape (a line of 2 up or down, or a cone of 3 to either side), on
// the rules of 2026-10-27. *China*: the China party against the Steppe
// party (`modWinPct`). *Seat*: the Vanguard in the Grappler's seat against
// the three Steppe heroes.
const steppe = ['bokh', 'mangudai', 'storm'];
const china = ['youxia', 'modao', 'alchemist'];
export const experiments = {};
for (const shape of ['built', 'lines']) {
  const patch = (c) => (c.ABILITY.cleave.shape = shape);
  experiments[`${shape}-china-for-steppe`] = {patch, mod: {party: china}};
  experiments[`${shape}-vanguard-for-grappler`] = {
    patch,
    mod: {party: steppe.map((h) => (h === 'bokh' ? 'modao' : h))},
  };
}
