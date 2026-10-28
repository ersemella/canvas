// The Priest (2026-10-28: speed 2, defence 1, power 3, Blessing, a heal of
// his power on an ally within 2, himself too, the rest of it Shield until
// the ally's next turn) in the support seat of a Steppe and a China mirror
// and the Persian one, against the support it replaces; and variants: power
// 2, no overheal, a Shield of 1 on top, and the camel left out. `modWinPct`
// throughout.
const steppe = ['bokh', 'mangudai', 'storm'];
const china = ['youxia', 'modao', 'alchemist'];
const persia = ['archer', 'mahout', 'magus'];
const seat = (party, i, hero) => party.map((h, j) => (j === i ? hero : h));
const variants = {
  built: () => {},
  power2: (c) => {
    c.HEROES.priest.power = 2;
  },
  noOverheal: (c) => {
    c.ABILITY.blessing.overheal = false;
  },
  shield1: (c) => {
    c.ABILITY.blessing.shield = 1;
  },
  noCamel: (c) => {
    c.ABILITY.blessing.camel = false;
  },
};
export const experiments = {};
for (const [v, patch] of Object.entries(variants))
  for (const [name, party] of [
    ['steppe', steppe],
    ['china', china],
    ['persia', persia],
  ])
    experiments[`priest-${v}-${name}`] = {party, patch, mod: {party: seat(party, 2, 'priest')}};
