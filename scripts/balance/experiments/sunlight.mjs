// Sunlight as Enhance (proposed, 2026-10-23; scripts/balance/sunlight.ts):
// the Storm Caller's second ability, Enhance 1 on a unit within 3 until the
// end of its next turn. Variants (owner): the Storm Caller may target itself
// (`self`), the Champion's Enhance adds to its squeeze (`squeeze`), and
// Sunlight melts hail where it lands (`melts`). Each variant: abilities
// removed from one side, then the stage caravans where the Storm Caller
// meets the Outrider. The AI counts an Enhance as one hit's extra damage
// while the unit has an enemy within reach (`enhanceGain` in ai.ts).
const variants = {
  base: {},
  self: {self: true},
  squeeze: {squeeze: true},
  melts: {melts: true},
  all: {self: true, squeeze: true, melts: true},
  // Not asked for: whether a bigger Enhance rescues it.
  enhance2: {enhance: 2},
};
const patchFor =
  ({self = false, squeeze = false, melts = false, enhance = 1}) =>
  ({ABILITY, HEROES}) => {
    HEROES.storm.abilities = ['hail', 'sunlight', 'hold'];
    Object.assign(ABILITY.sunlight, {self, melts, enhance});
    ABILITY.grapple.enhancedSqueeze = squeeze;
  };
const bans = {
  control: [],
  'no-sunlight': ['sunlight'],
  'no-hail': ['hail'],
  'no-grapple': ['grapple'],
  'no-bow': ['bow'],
  'no-volley': ['volley'],
};
const caravans = {
  'vs-mangudai+2wolves': ['mangudai', 'wolf', 'wolf'],
  'vs-mangudai+mangudai+wolf': ['mangudai', 'mangudai', 'wolf'],
  'vs-bokh+mangudai+wolf': ['bokh', 'mangudai', 'wolf'],
  'vs-mangudai+storm+wolf': ['mangudai', 'storm', 'wolf'],
  'vs-all-three': ['bokh', 'mangudai', 'storm'],
};
export const experiments = {};
for (const [name, ban] of Object.entries(bans)) experiments[`today:${name}`] = {mod: {ban}};
for (const [name, enemies] of Object.entries(caravans)) experiments[`today:${name}`] = {enemies};
for (const [v, opts] of Object.entries(variants)) {
  const patch = patchFor(opts);
  for (const [name, ban] of Object.entries(bans)) experiments[`${v}:${name}`] = {patch, mod: {ban}};
  for (const [name, enemies] of Object.entries(caravans))
    experiments[`${v}:${name}`] = {patch, enemies};
}
