// The Cataphract's slam as a Delay (2026-10-29): the rows of
// roster-twelve.mjs it is in, with the slam Delaying 4 (as built) and 6.
import {experiments as all} from './roster-twelve.mjs';
export const experiments = {};
for (const [name, e] of Object.entries(all)) {
  if (!/cataphract|byzantium/.test(name)) continue;
  for (const delay of [4, 6])
    experiments[`${name}-d${delay}`] = {
      ...e,
      patch: (c) => Object.assign(c.ABILITY.charge, {slam: 'delay', delay}),
    };
}
