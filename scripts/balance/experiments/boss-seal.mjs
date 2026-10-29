// The road out sealed while a boss stands (owner, 2026-10-29): whole runs
// for every party of three from the twelve heroes, as built (`sealed`) and
// with the seal off (`open`, no hero a boss), on the same seeds. Compare a
// boss stage's win rate with the stages around it, and the runs won.
const ROSTER = [
  'bokh',
  'mangudai',
  'storm',
  'modao',
  'alchemist',
  'youxia',
  'magus',
  'mahout',
  'archer',
  'varangian',
  'priest',
  'cataphract',
];
const parties = [];
for (let i = 0; i < ROSTER.length; i++)
  for (let j = i + 1; j < ROSTER.length; j++)
    for (let k = j + 1; k < ROSTER.length; k++) parties.push([ROSTER[i], ROSTER[j], ROSTER[k]]);
const open = (config) => {
  for (const hero of Object.values(config.HEROES)) if (hero.boss) hero.boss = false;
};
export const experiments = {};
for (const party of parties) {
  experiments[`sealed:${party.join('+')}`] = {party, group: 'sealed'};
  experiments[`open:${party.join('+')}`] = {party, group: 'open', patch: open};
}
