// The slam in place of the brace (owner's question, 2026-10-31): the
// Cataphract, the damage hero, has no walk (`moveCap` 0) and charges on
// 91.5-95% of his turns, so Armour 1 for 8 slots after each charge is on
// nearly always. Instead: no Armour, and each unit his charge carries into
// ruins or the map's edge Delayed (`ABILITY.charge.slam` `delay`), as
// measured for him as a tank on 2026-10-29 ("The slam as a Delay").
// `brace`: as built; `slamN`: no Armour, Delay N; `bare`: neither (owner,
// later 2026-10-31). Rows, `modWinPct`:
// - `${tag}-cataphract-for-O-R`: he in the damage seat of each other
//   region's mirror; `${tag}-O-for-cataphract-byzantium` each other damage
//   hero in his seat of Byzantium's.
// - `${tag}-byzantium-vs-R`: Byzantium's party against each region's.
// - `${tag}-novice` / `${tag}-expert`: his skill in the Steppe's damage seat.
const variant = (slam, delay, armour) => (c) => {
  Object.assign(c.ABILITY.charge, {slam, delay, armour});
};
const steppe = ['bokh', 'mangudai', 'storm'];
const regions = {
  steppe,
  china: ['modao', 'youxia', 'alchemist'],
  persia: ['mahout', 'archer', 'magus'],
  byzantium: ['varangian', 'cataphract', 'priest'],
};
const seat = (party, i, hero) => party.map((h, j) => (j === i ? hero : h));
const novice = {depth: 1, work: 220};
const expert = {depth: 4, work: 4 * 220};
export const experiments = {};
const variants = [
  ['brace', variant('none', 6, 1)],
  ['slam6', variant('delay', 6, 0)],
  ['slam9', variant('delay', 9, 0)],
  ['bare', variant('none', 6, 0)],
];
for (const [tag, patch] of variants) {
  for (const name of ['steppe', 'china', 'persia']) {
    experiments[`${tag}-cataphract-for-${regions[name][1]}-${name}`] = {party: regions[name], patch, mod: {party: seat(regions[name], 1, 'cataphract')}};
    experiments[`${tag}-${regions[name][1]}-for-cataphract-byzantium`] = {party: regions.byzantium, patch, mod: {party: seat(regions.byzantium, 1, regions[name][1])}};
    experiments[`${tag}-byzantium-vs-${name}`] = {party: regions[name], patch, mod: {party: regions.byzantium}};
  }
  for (const [level, search] of [['novice', novice], ['expert', expert]])
    experiments[`${tag}-${level}`] = {party: seat(steppe, 1, 'cataphract'), patch, mod: {search, searchHeroes: ['cataphract']}};
}
