// Whether Cleave's built shape (a line of 2 up or down, or a cone of 3 to
// either side) holds the Vanguard back, against the measuring switch's
// other shapes (`ABILITY.cleave.shape`): China's party against the
// Steppe's, and the Vanguard alone in the Grappler's seat. `hitsPerFight`
// gives the units a swing catches.
const china = ['youxia', 'modao', 'alchemist'];
const seat = ['modao', 'mangudai', 'storm'];
export const experiments = {};
for (const shape of ['built', 'lines', 'arcs', 'cones']) {
  const patch = (c) => (c.ABILITY.cleave.shape = shape);
  experiments[`china-${shape}`] = {mod: {party: china}, patch};
  experiments[`seat-${shape}`] = {mod: {party: seat}, patch};
}
