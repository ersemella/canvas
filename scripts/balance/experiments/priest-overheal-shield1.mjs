// The owner's Blessing, later 2026-10-28: a heal of the Priest's power, the
// heal beyond the ally's missing health becoming Shield, and a Shield of 1
// on top, all of it staying until damage spends it (`ABILITY.blessing`:
// `overheal`, `shield` 1, `lasts`), a unit holding at most `cap` of it: 3,
// 4 (one Blessing on an unhurt ally) or 8. In the support seats of
// priest.mjs.
const steppe = ['bokh', 'mangudai', 'storm'];
const china = ['youxia', 'modao', 'alchemist'];
const persia = ['archer', 'mahout', 'magus'];
const seat = (party, i, hero) => party.map((h, j) => (j === i ? hero : h));
const bless = (cap) => (c) =>
  Object.assign(c.ABILITY.blessing, {overheal: true, shield: 1, lasts: true, cap});
const variants = {cap3: bless(3), cap4: bless(4), cap8: bless(8)};
export const experiments = {};
for (const [v, patch] of Object.entries(variants))
  for (const [name, party] of [
    ['steppe', steppe],
    ['china', china],
    ['persia', persia],
  ])
    experiments[`priest-overheal-shield1-${v}-${name}`] = {
      party,
      patch,
      mod: {party: seat(party, 2, 'priest')},
    };
