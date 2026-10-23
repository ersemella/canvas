import {useCallback, useMemo, useState} from 'react';
import {hexEquals} from '@canvas/engine';
import type {Hex} from '@canvas/engine';
import {
  ABILITIES,
  abilitiesOf,
  actingUnit,
  aimSlot,
  mapOf,
  offeredTargets,
  previewTurn,
  reachableHexes,
} from '@canvas/games-silk-road-run';
import type {
  AbilityId,
  ActionTarget,
  FightState,
  Reach,
  TurnInput,
} from '@canvas/games-silk-road-run';

/** Skip turn's turn: Hold, without moving. */
export const SKIP: TurnInput = {action: {ability: 'hold', target: {}}};

/** Why an ability has nothing to target, when that disables it. */
const NO_TARGET: Partial<Record<AbilityId, string>> = {
  bow: 'No enemy in any of the bow’s lanes.',
  throw: 'You aren’t grappling an enemy, or there’s nowhere free to throw it.',
  grapple: 'No one within reach to grapple.',
  bite: 'No enemy next to you.',
};

/** What the player has picked for the acting unit's turn so far. */
interface Picks {
  plannedMove: Reach | null;
  ability: AbilityId | null;
  target: ActionTarget | null;
  /**
   * Picking where to move, as an ability picks its target: taps on reachable
   * hexes plan (or change) the move, which stays open until Confirm; other taps inspect.
   */
  moving: boolean;
}

const NO_PICKS: Picks = {plannedMove: null, ability: null, target: null, moving: false};

export type TurnPlan = ReturnType<typeof useTurnPlan>;

/**
 * The turn being planned for the acting unit: Move and its destination, or
 * an ability and its target, what that still needs, the turn it makes and
 * its preview, and what each choice costs or why it's disabled. The picks
 * belong to the fight they were made in: a new view from the server starts
 * the next turn with none.
 *
 * `hoverHex` is the hex under the mouse (desktop plans a move by hovering).
 */
export function useTurnPlan(fight: FightState | null, phone: boolean, hoverHex: Hex | null) {
  const [saved, setSaved] = useState<{fight: FightState | null; picks: Picks}>({
    fight,
    picks: NO_PICKS,
  });
  const picks = saved.fight === fight ? saved.picks : NO_PICKS;
  const {plannedMove, ability, target, moving} = picks;
  const pick = useCallback(
    (change: Partial<Picks>) =>
      setSaved((s) => ({fight, picks: {...(s.fight === fight ? s.picks : NO_PICKS), ...change}})),
    [fight]
  );

  const acting = fight ? actingUnit(fight) : undefined;

  const reaches = useMemo(
    () => (fight && acting ? reachableHexes(fight, mapOf(fight), acting) : []),
    [fight, acting]
  );

  /**
   * Desktop: with no ability picked, a click on a reachable hex plans a move
   * without Move first, as in XCOM (hovering already looks at hexes there).
   * Phones keep Move: a tap on the board looks at the hex.
   */
  const moveMode = moving || (!phone && !ability && reaches.some((r) => r.path.length > 0));
  /** Desktop: the reachable hex under the mouse, before one is picked: its path and cost show. */
  const hoverReach =
    !phone && moveMode && !plannedMove && hoverHex
      ? reaches.find((r) => r.path.length > 0 && hexEquals(r.hex, hoverHex))
      : undefined;

  /** What the chosen ability may target, always from the unit's current position. */
  const targets = useMemo(() => {
    if (!ability || !fight || !acting?.alive) return [];
    return offeredTargets(fight, mapOf(fight), acting, ABILITIES[ability]);
  }, [ability, fight, acting]);

  /**
   * Grapple's options on a unit: striking it from where the Champion
   * stands, and the hexes it may step in to first (2026-10-22).
   */
  /** The action with its target chosen, ready to preview. */
  const action = useMemo(() => {
    if (!ability || !target) return null;
    if (ability === 'throw' && !target.to) return null;
    return {ability, target};
  }, [ability, target]);

  /** What Move or the chosen ability still needs picked on the board: its button says so. */
  const needsTarget =
    moving && !plannedMove
      ? 'Pick where to move'
      : ability && !action
        ? ability === 'throw' && target?.hex
          ? 'Pick where to throw'
          : 'Pick a target'
        : null;

  /** The picked turn, once its hex or target is: the picked button confirms it. */
  const input: TurnInput | null = useMemo(() => {
    if (needsTarget || (!action && !plannedMove)) return null;
    const out: TurnInput = {action: action ?? {ability: 'hold', target: {}}};
    if (plannedMove && plannedMove.path.length > 0) {
      out.move = plannedMove.path;
    }
    return out;
  }, [action, needsTarget, plannedMove]);

  const preview = useMemo(
    () => (fight && acting && input ? previewTurn(fight, acting.id, input) : null),
    [fight, acting, input]
  );
  /** Skip turn: a Hold, whatever is picked. */
  const skipPreview = useMemo(
    () => (fight && acting ? previewTurn(fight, acting.id, SKIP) : null),
    [fight, acting]
  );

  /** The hex picked last: the destination, the target, or Throw's landing. */
  const lastPicked = plannedMove?.hex ?? target?.to ?? target?.hex ?? null;

  const clearMove = useCallback(() => pick({plannedMove: null, moving: false}), [pick]);

  /** Selecting an ability replaces any planned move. */
  const chooseAbility = useCallback(
    (id: AbilityId | null) => {
      if (!id) return pick({plannedMove: null, moving: false, ability: null, target: null});
      // Abilities with no target (Hold) preview at once.
      const own =
        fight && acting ? ABILITIES[id].targets(fight, mapOf(fight), acting, acting.hex!) : [];
      pick({
        plannedMove: null,
        moving: false,
        ability: id,
        target: own.length === 1 && own[0]!.hex === undefined ? {} : null,
      });
    },
    [fight, acting, pick]
  );

  const chooseTarget = useCallback(
    (t: ActionTarget) => pick({plannedMove: null, moving: false, target: t}),
    [pick]
  );

  /**
   * Move replaces the selected ability. Toggling it off undoes the move.
   */
  const toggleMove = useCallback(() => {
    if (plannedMove || moving) return clearMove();
    pick({ability: null, target: null, moving: true});
  }, [moving, plannedMove, clearMove, pick]);

  /**
   * A tap on `h` that plans the turn: a hex to move to, a target or Throw's
   * landing (or un-picks one tapped again). False when the
   * tap plans nothing, and the page looks at the hex instead.
   */
  const planTap = useCallback(
    (h: Hex): boolean => {
      if (!acting) return false;
      if (moveMode) {
        const reach = reaches.find((r) => r.path.length > 0 && hexEquals(r.hex, h));
        if (!reach) return false;
        // Tapping the chosen hex again un-picks it (Move's button confirms).
        pick({plannedMove: plannedMove && hexEquals(plannedMove.hex, h) ? null : reach});
        return true;
      }
      if (!ability) return false;
      if (ability === 'throw' && target?.hex) {
        // Throw's landing.
        const second = targets.find(
          (t) => hexEquals(t.hex!, target.hex!) && t.to && hexEquals(t.to, h)
        );
        if (second) {
          // Tapping the chosen hex again un-picks it (the button confirms).
          if (!target.to || !hexEquals(target.to, h)) chooseTarget(second);
          else pick({target: {hex: target.hex}});
          return true;
        }
      }
      const match = targets.find((t) => t.hex && hexEquals(t.hex, h));
      if (!match) return false;
      // Tapping the chosen target again un-picks it (the button confirms).
      if (target?.hex && hexEquals(target.hex, h)) pick({target: null});
      else if (ability === 'throw') chooseTarget({hex: h});
      else chooseTarget(match);
      return true;
    },
    [acting, moveMode, reaches, plannedMove, ability, target, targets, chooseTarget, pick]
  );

  /**
   * Steps back once: the step or landing picked last, then the target or
   * destination, then the ability or Move. False when nothing is picked.
   */
  const stepBack = useCallback((): boolean => {
    if (target?.to) pick({target: {hex: target.hex!}});
    else if (target?.hex) pick({target: null});
    else if (ability) chooseAbility(null);
    else if (plannedMove) pick({plannedMove: null});
    else if (moving) pick({moving: false});
    else return false;
    return true;
  }, [target, ability, plannedMove, moving, chooseAbility, pick]);

  /**
   * Slots until the unit's next turn after this one, whatever it does: its
   * speed places it before Temee's next turn (3.2). Yielding past taken
   * slots (3.3) is left to the preview, which shows both.
   */
  const slotsLater = useMemo(
    () => (fight && acting ? aimSlot(fight, acting) - fight.currentSlot : null),
    [fight, acting]
  );

  /** Abilities with nothing they may target from where the unit stands, and why: disabled. */
  const outOfReach = useMemo(() => {
    const out = new Map<AbilityId, {why: string}>();
    if (!fight || !acting?.alive) return out;
    const map = mapOf(fight);
    for (const def of abilitiesOf(acting)) {
      if (def.id === 'hold' || offeredTargets(fight, map, acting, def).length > 0) continue;
      out.set(def.id, {why: NO_TARGET[def.id] ?? 'Nothing to target from here.'});
    }
    return out;
  }, [fight, acting]);

  return {
    acting,
    plannedMove,
    ability,
    target,
    moving,
    reaches,
    moveMode,
    hoverReach,
    targets,
    needsTarget,
    input,
    preview,
    skipPreview,
    lastPicked,
    chooseAbility,
    toggleMove,
    planTap,
    stepBack,
    slotsLater,
    outOfReach,
  };
}
