// The owner's Blessing of 2026-10-28: a heal of the Priest's power, no
// overheal, and on top a Shield of 1 that stays until damage spends it
// (`ABILITY.blessing`: `overheal` off, `shield` 1, `lasts`), a unit
// holding at most `cap` of it: 1 (no stacking), 2 or 3. In the support
// seats of priest.mjs.
const steppe = ['bokh', 'mangudai', 'storm'];
const china = ['youxia', 'modao', 'alchemist'];
const persia = ['archer', 'mahout', 'magus'];
const seat = (party, i, hero) => party.map((h, j) => (j === i ? hero : h));
const heal = (cap) => (c) =>
  Object.assign(c.ABILITY.blessing, {overheal: false, shield: 1, lasts: true, cap});
const variants = {cap1: heal(1), cap2: heal(2), cap3: heal(3)};
export const experiments = {};
for (const [v, patch] of Object.entries(variants))
  for (const [name, party] of [
    ['steppe', steppe],
    ['china', china],
    ['persia', persia],
  ])
    experiments[`priest-heal-shield1-${v}-${name}`] = {
      party,
      patch,
      mod: {party: seat(party, 2, 'priest')},
    };
