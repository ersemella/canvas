/**
 * What a unit may choose on its turn, as the page offers it: the targets
 * shown for each ability, and whether anything but a Hold is left. A turn
 * with nothing left is skipped (`advanceToDecision`).
 */
import {abilitiesOf, unusableReason} from './abilities';
import type {AbilityDef} from './abilities';
import {reachableHexes, unitAt} from './board';
import type {MapData} from './map';
import {allowedTargets} from './taunt';
import type {ActionTarget, FightState, Unit} from './types';

/**
 * The targets offered for `def` from where `unit` stands: its allowed
 * targets (see `allowedTargets`), and for one aimed at a unit only enemies,
 * or for Sunlight only allies. The rules allow friendly fire; a player
 * isn't offered it (an area can still catch allies).
 */
export function offeredTargets(
  state: FightState,
  map: MapData,
  unit: Unit,
  def: AbilityDef
): ActionTarget[] {
  const targets = allowedTargets(state, map, unit, def);
  if (!def.targetsUnit) return targets;
  return targets.filter((t) => {
    const u = t.hex && unitAt(state, t.hex);
    return u && (def.id === 'sunlight') === (u.side === unit.side);
  });
}

/**
 * Whether Hold is all `unit` can do: it can't move (Immobilized, or boxed
 * in) and no usable ability is offered a target.
 */
export function onlyHold(state: FightState, map: MapData, unit: Unit): boolean {
  if (reachableHexes(state, map, unit).some((r) => r.path.length > 0)) return false;
  return abilitiesOf(unit).every(
    (def) =>
      def.id === 'hold' ||
      unusableReason(unit, def) !== null ||
      offeredTargets(state, map, unit, def).length === 0
  );
}
