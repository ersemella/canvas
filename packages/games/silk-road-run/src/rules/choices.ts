/**
 * What a unit may choose on its turn, as the page offers it: the targets
 * shown for each ability, and whether anything is left at all. A turn
 * with nothing left is skipped (`advanceToDecision`); there is no passing.
 */
import {abilitiesOf, unusableReason} from './abilities';
import type {AbilityDef} from './abilities';
import {canMove, unitAt} from './board';
import type {MapData} from './map';
import type {ActionTarget, FightState, Unit} from './types';

/** The targets the rules allow `def` from where `unit` stands. */
export function allowedTargets(
  state: FightState,
  map: MapData,
  unit: Unit,
  def: AbilityDef
): ActionTarget[] {
  return unit.hex ? def.targets(state, map, unit, unit.hex) : [];
}

/**
 * The targets offered for `def` from where `unit` stands: its allowed
 * targets, for one aimed at a unit only enemies, and for a support ability
 * (Sunlight) only its own side and spaces without a unit. The rules allow
 * friendly fire and helping enemies; a player isn't offered either (hail
 * can still catch allies).
 */
export function offeredTargets(
  state: FightState,
  map: MapData,
  unit: Unit,
  def: AbilityDef
): ActionTarget[] {
  const targets = allowedTargets(state, map, unit, def);
  if (def.kind === 'support')
    return targets.filter((t) => {
      const u = t.hex && unitAt(state, t.hex);
      return !u || u.side === unit.side;
    });
  if (!def.targetsUnit) return targets;
  return targets.filter((t) => {
    const u = def.aimedAt ? def.aimedAt(state, unit, t) : t.hex && unitAt(state, t.hex);
    return u && u.side !== unit.side;
  });
}

/**
 * Whether `unit` has nothing to do: it can't move (Immobilized, or boxed
 * in) and no usable ability is offered a target.
 */
export function nothingToDo(state: FightState, map: MapData, unit: Unit): boolean {
  if (canMove(state, map, unit)) return false;
  return abilitiesOf(unit).every(
    (def) =>
      unusableReason(unit, def) !== null || offeredTargets(state, map, unit, def).length === 0
  );
}
