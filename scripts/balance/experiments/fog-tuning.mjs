// Fog variants (2026-10-23), each measured by removing it from one side
// with the variant on both: the owner's first proposal (the space and its
// neighbours, Weaken 1) and one space at Weaken 2.
const variants = {
  'fog-radius1': (c) => (c.ABILITY.fog.radius = 1),
  'fog-weaken2': (c) => (c.ABILITY.fog.weaken = 2),
};
export const experiments = Object.fromEntries(
  Object.entries(variants).flatMap(([name, patch]) => [
    [`${name}:control`, {patch, mod: {}}],
    [`${name}:no-fog`, {patch, mod: {ban: ['fog']}}],
    [`${name}:no-hail`, {patch, mod: {ban: ['hail']}}],
  ])
);
