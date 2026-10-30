// Spearhead (2026-10-30), for the Vanguard: whenever it is hit, each ally
// next to it is Hastened 3 (`SPEARHEAD`, built off). `with-spearhead-china`
// gives it to one side's Vanguard in China's mirror, the passive's worth;
// the rest are the Vanguard's six rows of roles-twelve.mjs with every
// Vanguard carrying it (`patch`), to set beside "Each hero in its role,
// every duration in slots" (2026-10-29). `modWinPct` throughout.
const regions = {
  steppe: ['bokh', 'mangudai', 'storm'],
  china: ['modao', 'youxia', 'alchemist'],
  persia: ['mahout', 'archer', 'magus'],
  byzantium: ['cataphract', 'varangian', 'priest'],
};
const seat = (party, i, hero) => party.map((h, j) => (j === i ? hero : h));
const patch = ({HEROES}) => {
  HEROES.modao.passives = ['spearhead'];
};
export const experiments = {
  'with-spearhead-china': {party: regions.china, mod: {passives: {modao: ['spearhead']}}},
};
for (const [name, party] of Object.entries(regions))
  if (name !== 'china') {
    experiments[`modao-for-${party[0]}-${name}`] = {
      party,
      patch,
      mod: {party: seat(party, 0, 'modao')},
    };
    experiments[`${party[0]}-for-modao-china`] = {
      party: regions.china,
      patch,
      mod: {party: seat(regions.china, 0, party[0])},
    };
  }
// The same six rows without it, on today's code (the Barbarian's Leap is
// newer than the 2026-10-29 table).
for (const [name, e] of Object.entries(experiments))
  if (e.patch) experiments[`base-${name}`] = {party: e.party, mod: e.mod};
