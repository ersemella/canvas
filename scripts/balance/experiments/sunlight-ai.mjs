// How the AI values Empower (2026-10-23): Sunlight as it plays (Empower 2,
// self, melts, squeeze), with the AI counting this share of an Empower's
// worth (`AI.empoweredShare`; `empowerGain` in ai.ts). The share at which
// Sunlight is worth the most is the AI using it best (principle 4).
const shares = [1, 0.75, 0.5, 0.25];
export const experiments = {};
for (const share of shares) {
  const patch = ({AI}) => {
    AI.empoweredShare = share;
  };
  experiments[`share-${share}:control`] = {patch, mod: {}};
  experiments[`share-${share}:no-sunlight`] = {patch, mod: {ban: ['sunlight']}};
}
