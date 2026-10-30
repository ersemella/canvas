// Wait (Patient 4) on one Chinese hero at a time, in China's mirror.
const party = ['modao', 'youxia', 'alchemist'];
export const experiments = {};
for (const hero of party)
  experiments[`p4-${hero}`] = {
    patch: (c) => {
      c.RULES.patientSlots = 4;
    },
    party,
    mod: {passives: {[hero]: ['patient']}},
  };
