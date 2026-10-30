// Blessing in a line (the owner, 2026-10-30; `ABILITY.blessing.shape`
// `line`): every unit on one of the six straight lines out from the Priest,
// to the map's edge through anything, allies and enemies alike, healed his
// power; with Blessing's Shield as built (the excess and 1 more, lasting, at
// most 3) or as a heal alone (`overheal` off, `shield` 0); against Blessing
// as built. The seats of priest-track.mjs. `modWinPct` throughout.
const regions = {
  steppe: ['bokh', 'mangudai', 'storm'],
  china: ['modao', 'youxia', 'alchemist'],
  persia: ['mahout', 'archer', 'magus'],
};
const byzantium = ['cataphract', 'varangian', 'priest'];
const seat = (party, i, hero) => party.map((h, j) => (j === i ? hero : h));
const variants = {
  built: () => {},
  line: (c) => Object.assign(c.ABILITY.blessing, {shape: 'line'}),
  lineHeal: (c) => Object.assign(c.ABILITY.blessing, {shape: 'line', overheal: false, shield: 0}),
};
const novice = {depth: 1, work: 220};
const expert = {depth: 4, work: 4 * 220};
export const experiments = {};
for (const [v, patch] of Object.entries(variants)) {
  for (const [name, party] of Object.entries(regions)) {
    experiments[`${v}-priest-for-${party[2]}-${name}`] = {
      party,
      patch,
      mod: {party: seat(party, 2, 'priest')},
    };
    experiments[`${v}-${party[2]}-for-priest-byzantium`] = {
      party: byzantium,
      patch,
      mod: {party: seat(byzantium, 2, party[2])},
    };
  }
  for (const [level, search] of [
    ['novice', novice],
    ['expert', expert],
  ])
    experiments[`${v}-${level}-priest`] = {
      party: seat(regions.steppe, 2, 'priest'),
      patch,
      mod: {search, searchHeroes: ['priest']},
    };
}
// A control: the line with the Priest himself blessed too (`lineSelf`).
for (const [name, party] of Object.entries(regions))
  experiments[`lineSelf-priest-for-${party[2]}-${name}`] = {
    party,
    patch: (c) => Object.assign(c.ABILITY.blessing, {shape: 'line', lineSelf: true}),
    mod: {party: seat(party, 2, 'priest')},
  };
{
  const patch = (c) => Object.assign(c.ABILITY.blessing, {shape: 'line', lineSelf: true});
  for (const party of Object.values(regions))
    experiments[`lineSelf-${party[2]}-for-priest-byzantium`] = {
      party: byzantium,
      patch,
      mod: {party: seat(byzantium, 2, party[2])},
    };
  for (const [level, search] of [
    ['novice', novice],
    ['expert', expert],
  ])
    experiments[`lineSelf-${level}-priest`] = {
      party: seat(regions.steppe, 2, 'priest'),
      patch,
      mod: {search, searchHeroes: ['priest']},
    };
}
