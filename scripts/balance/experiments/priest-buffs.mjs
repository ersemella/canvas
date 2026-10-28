// Buffs for the Priest (2026-10-28), who measured weak as built in the
// support seats (priest.mjs): Blessing smiting an enemy for his power
// (`ABILITY.blessing.smite`), at range 3, speed 3, defence 2, and the AI
// valuing a Shield at its full worth (`AI.shieldShare` 1). `modWinPct`
// throughout, the Priest in the support seat of a Steppe and a China mirror.
const steppe = ['bokh', 'mangudai', 'storm'];
const china = ['youxia', 'modao', 'alchemist'];
const seat = (party, i, hero) => party.map((h, j) => (j === i ? hero : h));
const variants = {
  smite: (c) => {
    c.ABILITY.blessing.smite = true;
  },
  range3: (c) => {
    c.ABILITY.blessing.range = 3;
  },
  speed3: (c) => {
    c.HEROES.priest.speed = 3;
  },
  defence2: (c) => {
    c.HEROES.priest.defence = 2;
  },
  shieldShare1: (c) => {
    c.AI.shieldShare = 1;
  },
  'smite+speed3': (c) => {
    c.ABILITY.blessing.smite = true;
    c.HEROES.priest.speed = 3;
  },
};
export const experiments = {};
for (const [v, patch] of Object.entries(variants))
  for (const [name, party] of [
    ['steppe', steppe],
    ['china', china],
  ])
    experiments[`priest-${v}-${name}`] = {party, patch, mod: {party: seat(party, 2, 'priest')}};
