// Spearhead (2026-10-30), for the Vanguard: whenever it is hit, each ally
// next to it is Hastened 3 (`SPEARHEAD`, built off). `with-spearhead-china`
// gives it to one side's Vanguard in China's mirror, the passive's worth;
// the rest are the Vanguard's six rows of roles-twelve.mjs with every
// Vanguard carrying it (`patch`), to set beside "Each hero in its role,
// every duration in slots" (2026-10-29). `modWinPct` throughout.
// Variants (a suffix): `h5`, `h6` its Haste (`SPEARHEAD.haste`); `a1`, `a2`
// the AI's allies seeking it (`AI.spearheadShare`), both sides' AIs; `r2`
// allies within 2 (`SPEARHEAD.range`). Since the Vanguard starts with it at
// range 2 (2026-10-30), the `base-` rows and the variants without `-r2`
// reproduce only at their revision (`6b1e917` and before).
const regions = {
  steppe: ['bokh', 'mangudai', 'storm'],
  china: ['modao', 'youxia', 'alchemist'],
  persia: ['mahout', 'archer', 'magus'],
  byzantium: ['cataphract', 'varangian', 'priest'],
};
const seat = (party, i, hero) => party.map((h, j) => (j === i ? hero : h));
const variants = {
  '': {haste: 3, share: 0},
  '-h5': {haste: 5, share: 0},
  '-h6': {haste: 6, share: 0},
  '-a1': {haste: 3, share: 1},
  '-a2': {haste: 3, share: 2},
  '-h6-a1': {haste: 6, share: 1},
  '-r2': {haste: 3, share: 0, range: 2},
};
export const experiments = {};
for (const [suffix, {haste, share, range = 1}] of Object.entries(variants)) {
  const tune = ({SPEARHEAD, AI}) => {
    SPEARHEAD.haste = haste;
    SPEARHEAD.range = range;
    AI.spearheadShare = share;
  };
  const patch = (config) => {
    tune(config);
    config.HEROES.modao.passives = ['spearhead'];
  };
  experiments[`with-spearhead-china${suffix}`] = {
    party: regions.china,
    patch: tune,
    mod: {passives: {modao: ['spearhead']}},
  };
  for (const [name, party] of Object.entries(regions))
    if (name !== 'china') {
      experiments[`modao-for-${party[0]}-${name}${suffix}`] = {
        party,
        patch,
        mod: {party: seat(party, 0, 'modao')},
      };
      experiments[`${party[0]}-for-modao-china${suffix}`] = {
        party: regions.china,
        patch,
        mod: {party: seat(regions.china, 0, party[0])},
      };
    }
}
// The six rows without it, on today's code (the Barbarian's Leap is newer
// than the 2026-10-29 table).
for (const [name, e] of Object.entries(experiments))
  if (e.mod.party && !/-(h|a|r)\d/.test(name))
    experiments[`base-${name}`] = {party: e.party, mod: e.mod};
