// Longshot as built on 2026-10-28 (the first unit 2 or more away, flying over
// the spaces next to the Ranger, Piercing, Push 1) against the same with no
// Push and with Push 2 (`ABILITY.longshot.push`). The Ranger in the damage
// seat of a Steppe and a China mirror, as longshot-bracket.mjs.
const steppe = ['bokh', 'mangudai', 'storm'];
const china = ['youxia', 'modao', 'alchemist'];
const seat = (party, i, hero) => party.map((h, j) => (j === i ? hero : h));
export const experiments = {};
for (const [name, party, archerSeat] of [
  ['steppe', steppe, 1],
  ['china', china, 0],
])
  for (const push of [0, 1, 2])
    experiments[`archer-push${push}-${name}`] = {
      party,
      patch: (c) =>
        Object.assign(c.ABILITY.longshot, {
          first: true,
          minRange: 2,
          pierce: true,
          push,
          delay: 0,
          weaken: 0,
          pin: false,
        }),
      mod: {party: seat(party, archerSeat, 'archer')},
    };
