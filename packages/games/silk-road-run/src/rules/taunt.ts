/**
 * Taunt (17.5), from the Bökh Champion's Pin: while a unit is taunted, if
 * it can affect the taunter from any hex it can reach this turn, its
 * action must target the taunter or include it in its area, or be a Hold
 * (owner, 2026-10-20). A damaging
 * charged ability triggering while taunted is redirected onto the taunter
 * if it is in range. Ends early if the taunter dies.
 */
import {hexDistance, hexDirectionTo, hexEquals, hexNeighbor} from '@canvas/engine/server';
import type {Hex} from '@canvas/engine/server';
import {ABILITY, movementRules} from './config';
import {ABILITIES, abilitiesOf, reapLine, unusableReason} from './abilities';
import type {AbilityDef} from './abilities';
import {reachableHexes, walkable} from './board';
import type {MapData} from './map';
import type {ActionTarget, FightState, Unit} from './types';

/** The living unit taunting `unit`, if any. */
export function taunterOf(state: FightState, unit: Unit): Unit | undefined {
  for (const s of unit.statuses) {
    if (s.kind !== 'taunted') continue;
    const t = state.units.find((u) => u.id === s.source);
    if (t?.alive && t.hex) return t;
  }
  return undefined;
}

/** Whether `def`, used from `from` on `target`, targets the hex `victim` or includes it in its area. */
export function affectsHex(
  map: MapData,
  def: AbilityDef,
  from: Hex,
  target: ActionTarget,
  victim: Hex
): boolean {
  const near = (h: Hex | undefined, r: number) => h !== undefined && hexDistance(h, victim) <= r;
  switch (def.id) {
    case 'bow':
    case 'throw':
    case 'pin':
    case 'bite':
    case 'challenge':
      return near(target.hex, 0);
    case 'reap':
      return reapLine(map, from, hexDirectionTo(from, target.hex!)!).some((h) => near(h, 0));
    case 'advance':
      return hexDistance(from, victim) === 1;
    case 'hail':
    case 'sunlight':
      return near(target.hex, 0);
    case 'volley':
      return near(target.hex, ABILITY.volley.radius);
    case 'freeze':
      return near(target.hex, ABILITY.freeze.radius);
    case 'rampage': {
      // In or beside a hex of the charge's path.
      const dir = hexDirectionTo(from, target.hex!)!;
      let h = from;
      for (let i = 0; i < ABILITY.rampage.distance; i++) {
        h = hexNeighbor(h, dir);
        if (!walkable(map, h)) break;
        if (near(h, 1)) return true;
      }
      return false;
    }
    default:
      return false;
  }
}

/** Whether an action obeys a binding taunt: it affects the taunter, or it's a Hold. */
export function obeysTaunt(
  map: MapData,
  def: AbilityDef,
  from: Hex,
  target: ActionTarget,
  taunter: Unit
): boolean {
  return def.id === 'hold' || affectsHex(map, def, from, target, taunter.hex!);
}

/**
 * Whether the taunt binds `unit` this turn: some hex it can reach and some
 * usable ability there would affect `taunter`. If not, it acts freely.
 */
export function tauntBinds(state: FightState, map: MapData, unit: Unit, taunter: Unit): boolean {
  const start = unit.hex!;
  try {
    const reaches = movementRules(state).separateMovement
      ? [{hex: start, path: []}]
      : reachableHexes(state, map, unit);
    for (const reach of reaches) {
      // List targets as if standing there (only the hex matters for listing).
      unit.hex = reach.hex;
      for (const def of abilitiesOf(unit)) {
        if (unusableReason(unit, def)) continue;
        for (const t of def.targets(state, map, unit, reach.hex)) {
          if (affectsHex(map, def, reach.hex, t, taunter.hex!)) return true;
        }
      }
    }
  } finally {
    unit.hex = start;
  }
  return false;
}

/**
 * The targets `def` may take from where `unit` stands: all of them, or
 * under a binding taunt only those that affect the taunter (as a turn is
 * checked). For the page, so it shows and offers only what it may pick.
 */
export function allowedTargets(
  state: FightState,
  map: MapData,
  unit: Unit,
  def: AbilityDef
): ActionTarget[] {
  const targets = def.targets(state, map, unit, unit.hex!);
  const taunter = taunterOf(state, unit);
  if (!taunter || !tauntBinds(state, map, unit, taunter)) return targets;
  return targets.filter((t) => obeysTaunt(map, def, unit.hex!, t, taunter));
}

/**
 * A damaging charged ability triggering while taunted lands on the
 * taunter instead, if the taunter is a legal target from the charger's hex.
 */
export function redirectedCharge(state: FightState, map: MapData, unit: Unit, target: Hex): Hex {
  const def = ABILITIES[unit.charging!.ability];
  const taunter = taunterOf(state, unit);
  if (!def.damaging || !taunter || !unit.hex) return target;
  const inRange = def
    .targets(state, map, unit, unit.hex)
    .some((t) => t.hex && hexEquals(t.hex, taunter.hex!));
  return inRange ? taunter.hex! : target;
}
