// Variants of the new abilities (2026-10-23), each measured by removing the
// ability from one side (its worth) with the variant on both: Overwatch
// shooting every unit that enters, its shot stopping a walk, both; and
// Sunlight healing 2. See new-abilities.mjs for the abilities as built.
const variants = {
  'ow-every': (c) => (c.ABILITY.overwatch.everyUnit = true),
  'ow-stops': (c) => (c.ABILITY.overwatch.stopsWalk = true),
  'ow-every-stops': (c) => {
    c.ABILITY.overwatch.everyUnit = true;
    c.ABILITY.overwatch.stopsWalk = true;
  },
  'sun-heal2': (c) => (c.ABILITY.sunlight.heal = 2),
};
const banned = {ow: 'overwatch', sun: 'sunlight'};
export const experiments = Object.fromEntries(
  Object.entries(variants).flatMap(([name, patch]) => [
    [`${name}:control`, {patch, mod: {}}],
    [`${name}:no-${banned[name.split('-')[0]]}`, {patch, mod: {ban: [banned[name.split('-')[0]]]}}],
  ])
);
