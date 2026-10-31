// The config experiments patch, saved before and restored after, so one
// experiment's patch never leaks into the next.
/** Mutable views of the config, for experiments to patch. */
export type Config = {
  ABILITY: any;
  AI: any;
  HEROES: any;
  RULES: any;
  ABILITIES: any;
  SPEARHEAD: any;
  FURY: any;
};
/** Saves the config; the function returned restores it. */
export function snapshot(config: Config) {
  const copy = (x: unknown) =>
    JSON.parse(
      JSON.stringify(x, (_k, v) => (v === Infinity ? 'Infinity' : v)),
      (_k, v) => (v === 'Infinity' ? Infinity : v)
    );
  const saved = copy({
    ABILITY: config.ABILITY,
    AI: config.AI,
    HEROES: config.HEROES,
    RULES: config.RULES,
    SPEARHEAD: config.SPEARHEAD,
    FURY: config.FURY,
  });
  return () => {
    const restore = (target: any, from: any) => {
      // A key the experiment added (a hero's `passives`) goes too.
      for (const k of Object.keys(target)) if (!(k in from)) delete target[k];
      for (const [k, v] of Object.entries(from)) {
        if (v && typeof v === 'object' && !Array.isArray(v)) restore(target[k], v);
        else target[k] = v;
      }
    };
    for (const key of ['ABILITY', 'AI', 'HEROES', 'RULES', 'SPEARHEAD', 'FURY'] as const)
      restore(config[key], saved[key]);
  };
}
