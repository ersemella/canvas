/**
 * What a unit may choose on its turn, as the page offers it: the targets
 * shown for each ability, and whether anything but a Hold is left. A turn
 * with nothing left is skipped (`advanceToDecision`).
 */
import {hexEquals, hexKey} from '@canvas/engine/server';
import type {Hex} from '@canvas/engine/server';
import {abilitiesOf, unusableReason} from './abilities';
import type {AbilityDef} from './abilities';
import {canMove, hostile, unitAt, walkable} from './board';
import {mends} from './resolve';
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
 * (Sunlight) only its own side and spaces without a unit, and for one that
 * helps allies and hinders enemies (Elixir) both. The rules allow
 * friendly fire and helping enemies; a player isn't offered either (hail
 * can still catch allies), but an ally its attack would heal (Mending
 * Strike and Shot, 19.9) is.
 */
export function offeredTargets(
  state: FightState,
  map: MapData,
  unit: Unit,
  def: AbilityDef
): ActionTarget[] {
  const targets = allowedTargets(state, map, unit, def);
  if (def.bothSides) return targets;
  if (def.kind === 'support')
    return targets.filter((t) => {
      const u = t.hex && unitAt(state, t.hex);
      return !u || u.side === unit.side;
    });
  if (!def.targetsUnit) return targets;
  return targets.filter((t) => {
    const u = def.aimedAt ? def.aimedAt(state, unit, t) : t.hex && unitAt(state, t.hex);
    return u && (u.side !== unit.side || mends(unit, u));
  });
}

/**
 * Every space `unit` could cast `def` on from where it stands, as an
 * inspected enemy's ability shows it: the targets offered now (and the
 * spaces each swing of an area ability would hit), and, for one aimed at a
 * unit, every free space where a foe would be hit if it stood there: a melee
 * attack's every neighbour, a lane's spaces up to the first unit in it.
 */
export function castableSpaces(
  state: FightState,
  map: MapData,
  unit: Unit,
  def: AbilityDef
): Hex[] {
  const out = new Map<string, Hex>();
  const add = (h: Hex) => out.set(hexKey(h), h);
  const from = unit.hex;
  if (!from) return [];
  for (const t of offeredTargets(state, map, unit, def)) {
    if (!t.hex) continue;
    add(t.hex);
    if (def.area) for (const h of def.area(map, from, t.hex)) add(h);
  }
  if (def.targetsUnit) {
    // A foe to stand in each free space in turn: one of the foes on the board, plain.
    const foes = state.units.filter((u) => u.alive && hostile(u, unit));
    const model = foes.find((u) => u.hero !== 'camel') ?? foes[0];
    if (model)
      for (const h of map.hexes) {
        if (!walkable(map, h) || unitAt(state, h)) continue;
        const probe: Unit = {...model, id: '__probe', hex: h, statuses: []};
        const probed = {...state, units: [...state.units, probe]};
        const hit = offeredTargets(probed, map, unit, def).some(
          (t) =>
            (def.aimedAt ? def.aimedAt(probed, unit, t) : t.hex && unitAt(probed, t.hex)) === probe
        );
        if (hit) add(h);
      }
  }
  return [...out.values()];
}

/**
 * The target among `targets` that a tap on `h` picks for `def` from
 * `from`: the one on `h`, else, for an ability whose area runs out from
 * its user, the one whose area holds `h` (Cleave: any space of its line,
 * not just the first it's aimed at).
 */
export function targetAt(
  map: MapData,
  from: Hex,
  def: AbilityDef,
  targets: ActionTarget[],
  h: Hex
): ActionTarget | undefined {
  return (
    targets.find((t) => t.hex && hexEquals(t.hex, h)) ??
    (def.area
      ? targets.find((t) => t.hex && def.area!(map, from, t.hex).some((a) => hexEquals(a, h)))
      : undefined)
  );
}

/**
 * Whether Hold is all `unit` can do: it can't move (Immobilized, or boxed
 * in) and no usable ability is offered a target.
 */
export function onlyHold(state: FightState, map: MapData, unit: Unit): boolean {
  if (canMove(state, map, unit)) return false;
  return abilitiesOf(unit).every(
    (def) =>
      def.id === 'hold' ||
      unusableReason(unit, def) !== null ||
      offeredTargets(state, map, unit, def).length === 0
  );
}
