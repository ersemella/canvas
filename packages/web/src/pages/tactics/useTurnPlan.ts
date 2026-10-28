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
  targetAt,
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
  snapShot: 'No enemy in any of Snap Shot’s lanes.',
  skirmish: 'No free space to step to with an enemy in line from it.',
  sunlight: 'No ally within reach to Empower, nor hail to melt.',
  grapple: 'No one within reach to grapple whom you aren’t grappling already.',
  bite: 'No enemy next to you.',
  swiftStrike: 'No enemy next to you.',
  omen: 'No unit within 3 whose turn comes before your next.',
  trample: 'Nowhere to Trample.',
  longshot: 'No one in any of your lanes.',
  shove: 'No one next to you to shove.',
  haul: 'No one 2 or 3 spaces away in a straight line.',
  feignedRetreat: 'No enemy in any of your lanes, or nowhere to fall back to.',
};

/**
 * Abilities picked in two taps, the unit aimed at and a space (`to`), and
 * the prompt for the space: Feigned Retreat's target, then where it falls
 * back to; Omen's two units (as `bracket` or `swap`), one then the other; for an ability that steps first (Skirmish, `steps`), the space, then the target
 * in line from there.
 */
const SECOND_PICK: Partial<Record<AbilityId, string>> = {
  feignedRetreat: 'Pick where to fall back',
  omen: 'Pick the unit to wait until after your next turn',
  skirmish: 'Pick where to step',
};
/** The second pick's prompt, if `id` takes two; none for Omen on one unit (`pairs` off, as built). */
const secondPick = (id: AbilityId) => (ABILITIES[id].pairs === false ? undefined : SECOND_PICK[id]);
const stepsFirst = (id: AbilityId | null) => Boolean(id && ABILITIES[id].steps);

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

  /** The action with its target chosen, ready to preview. */
  const action = useMemo(() => {
    if (!ability || !target) return null;
    if (secondPick(ability) && (!target.to || !target.hex)) return null;
    return {ability, target};
  }, [ability, target]);

  /** What Move or the chosen ability still needs picked on the board: its button says so. */
  const needsTarget =
    moving && !plannedMove
      ? 'Pick where to move'
      : ability && !action
        ? stepsFirst(ability)
          ? target?.to
            ? 'Pick a target'
            : secondPick(ability)!
          : secondPick(ability) && target?.hex
            ? secondPick(ability)!
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

  /** The hex picked last: the destination, the target, Feigned Retreat's fall-back, or Skirmish's step before its target. */
  const lastPicked =
    plannedMove?.hex ??
    (stepsFirst(ability) ? (target?.hex ?? target?.to) : (target?.to ?? target?.hex)) ??
    null;

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
   * A tap on `h` that plans the turn: a hex to move to, a target (Grapple's
   * throw is one: where it lands), Feigned Retreat's fall-back or Skirmish's step (or un-picks one tapped again). False when the
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
      if (stepsFirst(ability)) {
        // Skirmish: the space to step to, then a target in line from there.
        const step = targets.find((t) => t.to && hexEquals(t.to, h));
        if (target?.to) {
          const shot = targets.find(
            (t) => hexEquals(t.to!, target.to!) && t.hex && hexEquals(t.hex, h)
          );
          if (shot) {
            // Tapping the chosen target again un-picks it (the button confirms).
            if (target.hex && hexEquals(target.hex, h)) pick({target: {to: target.to}});
            else chooseTarget(shot);
            return true;
          }
          // The chosen space again un-picks it; another space replaces it.
          if (hexEquals(target.to, h)) {
            pick({target: null});
            return true;
          }
        }
        if (!step) return false;
        chooseTarget({to: step.to!});
        return true;
      }
      if (secondPick(ability) && target?.hex) {
        // Where Feigned Retreat falls back to.
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
      // Cleave's line: a tap anywhere in it aims it.
      const match =
        fight && acting.hex && targetAt(mapOf(fight), acting.hex, ABILITIES[ability], targets, h);
      if (!match) return false;
      // Tapping the chosen target again un-picks it (the button confirms).
      if (target?.hex && hexEquals(target.hex, match.hex!)) pick({target: null});
      else if (secondPick(ability)) chooseTarget({hex: match.hex!});
      else chooseTarget(match);
      return true;
    },
    [fight, acting, moveMode, reaches, plannedMove, ability, target, targets, chooseTarget, pick]
  );

  /**
   * Steps back once: the step or landing picked last, then the target or
   * destination, then the ability or Move. False when nothing is picked.
   */
  const stepBack = useCallback((): boolean => {
    if (stepsFirst(ability) && target?.hex) pick({target: {to: target.to!}});
    else if (target?.to && !stepsFirst(ability)) pick({target: {hex: target.hex!}});
    else if (target?.hex || target?.to) pick({target: null});
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
