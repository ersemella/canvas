// Eye of the Storm (the owner's proposal, 2026-10-27) as the Storm Caller's
// core in place of Hail: an ally exactly 2 away or itself heals the Storm
// Caller's power (with its Empower and Weaken), and every unit next to it
// that hits is Weakened 1. Run on the rules with it built, Hail an upgrade.
// *Head to head*: one side's Storm Caller with Hail as its core (`mod.kits`),
// alone and with each upgrade, against Eye with the same upgrade
// (`modWinPct` above 50%: Hail the stronger). *Worth*: Eye banned on one
// side. *Seat*: a Chinese hero in the Storm Caller's seat, with each core
// (50% their equal, lower a stronger Storm Caller). *Caravans*: the stage
// caravans with a Storm Caller against the full party, with each core
// (`playerWinPct`).
const steppe = ['bokh', 'mangudai', 'storm'];
const china = ['youxia', 'modao', 'alchemist'];
const cores = {
  eye: undefined,
  hail: ({HEROES}) => {
    HEROES.storm.abilities = ['hail', 'hold'];
  },
};
export const experiments = {
  'hail-vs-eye': {mod: {kits: {storm: ['hail', 'hold']}}},
  'no-eye': {mod: {ban: ['eye']}},
};
for (const up of ['sunlight', 'gale']) {
  const patch = ({HEROES}) => {
    HEROES.storm.abilities = ['eye', up, 'hold'];
  };
  experiments[`hail+${up}-vs-eye+${up}`] = {patch, mod: {kits: {storm: ['hail', up, 'hold']}}};
}
for (const [core, patch] of Object.entries(cores)) {
  for (const hero of china)
    experiments[`${core}:${hero}-for-storm`] = {
      patch,
      mod: {party: steppe.map((h) => (h === 'storm' ? hero : h))},
    };
  experiments[`${core}:vs-storm+2wolves`] = {patch, enemies: ['storm', 'wolf', 'wolf']};
  experiments[`${core}:vs-bokh+storm+wolf`] = {patch, enemies: ['bokh', 'storm', 'wolf']};
  experiments[`${core}:vs-mangudai+storm+wolf`] = {patch, enemies: ['mangudai', 'storm', 'wolf']};
  experiments[`${core}:vs-all-three`] = {patch, enemies: steppe};
}
