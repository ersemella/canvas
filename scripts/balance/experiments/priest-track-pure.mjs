// Blessing by the track as a pure support (the owner, 2026-10-30;
// `ABILITY.blessing.trackSmite` off): an ally whose card is under 5 slots
// on healed by `bands`, the excess a lasting Shield (`trackShield`, at most
// 3), no enemy hit, range 3; against the same with the smite and Blessing as
// built, all on today's rules; and the pure support with the split later
// (7, 9: every ally acting before his next turn), in the other seats. The seats of priest-track.mjs. `modWinPct`.
const regions = {
  steppe: ['bokh', 'mangudai', 'storm'],
  china: ['modao', 'youxia', 'alchemist'],
  persia: ['mahout', 'archer', 'magus'],
};
const byzantium = ['cataphract', 'varangian', 'priest'];
const seat = (party, i, hero) => party.map((h, j) => (j === i ? hero : h));
const track =
  (trackSmite, split = 5) =>
  (c) =>
    Object.assign(c.ABILITY.blessing, {
      mode: 'track',
      scale: 'bands',
      range: 3,
      trackShield: true,
      trackSmite,
      split,
    });
const variants = {built: () => {}, smite: track(true), pure: track(false)};
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
for (const split of [7, 9])
  for (const [name, party] of Object.entries(regions))
    experiments[`pure-split${split}-priest-for-${party[2]}-${name}`] = {
      party,
      patch: track(false, split),
      mod: {party: seat(party, 2, 'priest')},
    };
