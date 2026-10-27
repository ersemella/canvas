// Rain in place of Hail for the Storm Caller (ABILITY.rain): every hero
// swapped with the Storm Caller in every party of three (`modWinPct`: the
// Storm Caller's side above 50% when it is `storm` in), and the regions' last
// stages against Grappler, Horse Archer and the Storm Caller with the camel.
const heroes = ['bokh', 'modao', 'mangudai', 'youxia', 'alchemist'];
const variants = {
  hail: () => {},
  'rain-p1': (c) => void (c.HEROES.storm.abilities = ['rain', 'hold']),
  'rain-p2': (c) => {
    c.HEROES.storm.abilities = ['rain', 'hold'];
    c.HEROES.storm.power = 2;
  },
  'rain-p1-everyone': (c) => {
    c.HEROES.storm.abilities = ['rain', 'hold'];
    c.ABILITY.rain.enemies = true;
  },
};
export const experiments = {};
for (const [v, patch] of Object.entries(variants)) {
  for (const h of heroes) {
    const rest = heroes.filter((x) => x !== h);
    for (let i = 0; i < rest.length; i++)
      for (let j = i + 1; j < rest.length; j++)
        experiments[`${v}:storm-for-${h}@${rest[i]}+${rest[j]}`] = {
          patch,
          party: [h, rest[i], rest[j]],
          mod: {party: ['storm', rest[i], rest[j]]},
        };
  }
  const party = ['bokh', 'mangudai', 'storm'];
  experiments[`${v}:vs-steppe3`] = {patch, party, enemies: party};
  experiments[`${v}:vs-china3`] = {patch, party, enemies: ['youxia', 'modao', 'alchemist'], map: 'flaming'};
}
