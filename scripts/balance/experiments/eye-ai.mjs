// Is the AI underplaying Eye of the Storm? (2026-10-27) The Eye measured
// best (on an empty space too, heal 2, Weaken 2) against Hail as the Storm
// Caller's core. *Depth*: one side's AI searching deeper (depth 4, 4 × the
// work), as `china-buffs.mjs` did: if Eye gains more from it than Hail
// does, the production AI underplays Eye. *Keeping back*: the AI placing a
// Storm Caller that can't hurt 2 from an ally rather than next to an enemy
// (`AI.supportKeepsBack`), at heal 2 / Weaken 2 and at 1/1, Eye on an
// empty space too. `modWinPct` is the modified side's share each time.
const deep = {depth: 4, work: 4 * 220};
const eye22 = (c) => Object.assign(c.ABILITY.eye, {anywhere: true, heal: 1, weaken: 2});
const eye11 = (c) => Object.assign(c.ABILITY.eye, {anywhere: true});
const hailCore = ({HEROES}) => {
  HEROES.storm.abilities = ['hail', 'hold'];
};
const keepBack = (c) => {
  c.AI.supportKeepsBack = true;
};
export const experiments = {
  // Eye's side deep against Hail's (44.6% at production: 100 − 55.4).
  'eye-deep-vs-hail': {
    patch: (c) => (eye22(c), hailCore(c)),
    mod: {kits: {storm: ['eye', 'hold']}, search: deep},
  },
  // Hail's side deep against Eye's (55.4% at production).
  'hail-deep-vs-eye': {patch: eye22, mod: {kits: {storm: ['hail', 'hold']}, search: deep}},
  // Hail's side against Eye's, the AI keeping a Storm Caller that can't hurt back.
  'keepback:hail-vs-eye22': {
    patch: (c) => (eye22(c), keepBack(c)),
    mod: {kits: {storm: ['hail', 'hold']}},
  },
  'keepback:hail-vs-eye11': {
    patch: (c) => (eye11(c), keepBack(c)),
    mod: {kits: {storm: ['hail', 'hold']}},
  },
  // Its baseline: 1/1 on an empty space without keeping back (63.4% above).
};
