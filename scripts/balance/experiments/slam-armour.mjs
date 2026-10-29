// The Cataphract with the slam Delaying 6 (as built) and Armoured back
// (2026-10-29): the rows of roster-twelve.mjs it is in. Every row sets
// the passive, since the config's restore keeps a key a patch adds.
import {experiments as all} from './roster-twelve.mjs';
export const experiments = {};
for (const [name, e] of Object.entries(all)) {
  if (!/cataphract|byzantium/.test(name)) continue;
  experiments[name] = {
    ...e,
    patch: (c) => {
      Object.assign(c.ABILITY.charge, {slam: 'delay', delay: 6});
      c.HEROES.cataphract.passives = ['armoured'];
    },
  };
}
