// Sunlight as Enhance (proposed, 2026-10-23): an ability for balance
// experiments only. It is registered in ABILITIES but in no hero's kit, so
// the game and its page are unchanged; an experiment adds it to the Storm
// Caller's kit and picks its variant in `ABILITY.sunlight`.
import {hexEquals, hexesInRange} from '@canvas/engine/server';
import {ABILITY} from '@balance-rules/config';
import {ABILITIES} from '@balance-rules/abilities';
import type {AbilityDef} from '@balance-rules/abilities';
import {onMap, sortByHex, unitAt} from '@balance-rules/board';
import {enhance, log, unitName} from '@balance-rules/resolve';
import {tileAt} from '@balance-rules/map';
import type {AbilityId} from '@balance-rules/types';

/**
 * `range`: how far it reaches. `enhance`: the Enhance it gives, until the
 * end of the target's next turn. `self`: whether the Storm Caller may
 * target itself (its own next Hail then deals 2). `melts`: hail on the
 * target's space melts, freeing whoever it held, and a space with hail and
 * no unit can be targeted to melt it. Whether Enhance adds to Grapple's
 * squeeze is `ABILITY.grapple.enhancedSqueeze`.
 */
const defaults = {range: 3, enhance: 1, self: false, melts: false};
const config = ABILITY as unknown as {sunlight: typeof defaults};
config.sunlight = {...defaults};

// A unit already Enhanced can't be targeted: renewing an Enhance on itself
// turn after turn, the Storm Caller never spent it.
const sunlight: AbilityDef = {
  id: 'sunlight' as AbilityId,
  name: 'Sunlight',
  kind: 'control',
  range: defaults.range,
  summary: () => `Enhance ${config.sunlight.enhance} a unit until the end of its next turn.`,
  targets(state, map, user, from) {
    const {range, self, melts} = config.sunlight;
    const hexes = hexesInRange(from, range).filter((h) => {
      if (!onMap(map, h) || tileAt(map, h) === 'obstacle') return false;
      // Only where it would do something: hail to melt, or a unit that hits
      // (not Temee) to Enhance.
      if (melts && state.effects.some((e) => hexEquals(e.hex, h))) return true;
      const u = unitAt(state, h);
      // Not a unit already Enhanced: renewing it would never spend it.
      return u !== undefined && u.power > 0 && !u.enhance && (u !== user || self);
    });
    return sortByHex(hexes, (h) => h).map((hex) => ({hex}));
  },
  resolve(ctx, user, target) {
    const hex = target.hex!;
    log(ctx, `${unitName(user)} calls down sunlight.`);
    if (config.sunlight.melts) {
      const hail = ctx.state.effects.find((e) => hexEquals(e.hex, hex));
      if (hail) {
        ctx.state.effects = ctx.state.effects.filter((e) => e !== hail);
        for (const u of ctx.state.units)
          u.statuses = u.statuses.filter((s) => s.hail !== hail.source);
        log(ctx, 'The sunlight melts the hail.');
      }
    }
    const u = unitAt(ctx.state, hex);
    if (u) enhance(ctx, u, config.sunlight.enhance);
  },
};

(ABILITIES as Record<string, AbilityDef>).sunlight = sunlight;
