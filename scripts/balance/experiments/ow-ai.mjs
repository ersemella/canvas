// Overwatch with the AI valuing its lanes (2026-10-23): the ability's worth, as built and in the variants.
export const experiments = {
  control: {mod: {}},
  'no-overwatch': {mod: {ban: ['overwatch']}},
  'ow-every:no-overwatch': {
    patch: (c) => (c.ABILITY.overwatch.everyUnit = true),
    mod: {ban: ['overwatch']},
  },
  'ow-stops:no-overwatch': {
    patch: (c) => (c.ABILITY.overwatch.stopsWalk = true),
    mod: {ban: ['overwatch']},
  },
};
