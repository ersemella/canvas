import {useCallback, useMemo, useState} from 'react';
import {hexEquals} from '@canvas/engine';
import type {Hex} from '@canvas/engine';
import {
  ABILITIES,
  HEROES,
  RULES,
  abilitiesOf,
  actingUnit,
  arrowLanes,
  isPinned,
  mapOf,
  obscured,
  offeredTargets,
  previewTurn,
  reachableHexes,
  slotsForward,
  tauntBinds,
  taunterOf,
  turnCost,
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
  shove: 'You aren’t pinning an enemy next to you.',
  leap: 'Nowhere to land.',
  lunge: 'No one in reach to lunge at.',
  reap: 'No one in any of the six cones around you.',
  challenge: 'No enemy in range.',
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

  /**
   * What the chosen ability may target, always from the unit's current
   * position (under a binding taunt, only what affects the taunter).
   */
  const targets = useMemo(() => {
    if (!ability || !fight || !acting?.alive) return [];
    return offeredTargets(fight, mapOf(fight), acting, ABILITIES[ability]);
  }, [ability, fight, acting]);

  /**
   * Lunge's options on a unit: striking it from where the Champion stands,
   * and the hexes it may bound to first (2026-10-22; Pin's step until then).
   */
  const lungeFromHere = useCallback(
    (h: Hex) => targets.some((t) => !t.to && t.hex && hexEquals(t.hex, h)),
    [targets]
  );
  const lungeSteps = useCallback(
    (h: Hex) => targets.filter((t) => t.to && t.hex && hexEquals(t.hex, h)),
    [targets]
  );

  /** The action with its target chosen, ready to preview. */
  const action = useMemo(() => {
    if (!ability || !target) return null;
    if (ability === 'throw' && !target.to) return null;
    // A unit a Lunge can't reach from here needs its landing picked.
    if (ability === 'lunge' && !target.to && !lungeFromHere(target.hex!)) return null;
    return {ability, target};
  }, [ability, target, lungeFromHere]);

  /** What Move or the chosen ability still needs picked on the board: its button says so. */
  const needsTarget =
    moving && !plannedMove
      ? 'Pick where to move'
      : ability && !action
        ? ability === 'throw' && target?.hex
          ? 'Pick where to throw'
          : ability === 'lunge' && target?.hex
            ? 'Pick where to land'
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

  /** The hex picked last: the destination, the target, or Throw's landing or Lunge's landing. */
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
   * A tap on `h` that plans the turn: a hex to move to, a target, Throw's
   * landing or Lunge's landing (or un-picks one tapped again). False when the
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
      if ((ability === 'throw' || ability === 'lunge') && target?.hex) {
        // Throw's landing, or the hex a Lunge bounds to first.
        const second = targets.find(
          (t) => hexEquals(t.hex!, target.hex!) && t.to && hexEquals(t.to, h)
        );
        if (second) {
          // Tapping the chosen hex again un-picks it (the button confirms).
          if (!target.to || !hexEquals(target.to, h)) chooseTarget(second);
          else pick({target: {hex: target.hex}});
          return true;
        }
        // Tapping the Champion drops the bound, if it can strike from where it stands.
        if (
          ability === 'lunge' &&
          target.to &&
          acting.hex &&
          hexEquals(acting.hex, h) &&
          lungeFromHere(target.hex)
        ) {
          chooseTarget({hex: target.hex});
          return true;
        }
      }
      const match = targets.find((t) => t.hex && hexEquals(t.hex, h));
      if (!match) return false;
      // Tapping the chosen target again un-picks it (the button confirms).
      if (target?.hex && hexEquals(target.hex, h)) pick({target: null});
      else if (ability === 'throw') chooseTarget({hex: h});
      else if (ability === 'lunge') {
        // From here if it can; otherwise its only landing, or a landing still to pick.
        const steps = lungeSteps(h);
        chooseTarget(!lungeFromHere(h) && steps.length === 1 ? steps[0]! : {hex: h});
      } else chooseTarget(match);
      return true;
    },
    [
      acting,
      moveMode,
      reaches,
      plannedMove,
      ability,
      target,
      targets,
      chooseTarget,
      lungeFromHere,
      lungeSteps,
      pick,
    ]
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
   * Slots an ability of `actionCost`: the placement
   * formula alone (3.2). Yielding past taken slots (3.3) is left to the
   * preview, which shows both, so a button's cost never jumps with the track.
   */
  const slotsLater = useCallback(
    (actionCost: number) => (acting ? slotsForward(actionCost, acting.speed) : 0),
    [acting]
  );

  /**
   * Abilities with nothing they may target from where the unit stands, and
   * why: disabled. Under a binding taunt that's anything that can't affect
   * the taunter, and a short note says so on the button itself, as it does
   * for an Obscured bow, since the reason is otherwise only a hover's title.
   */
  const outOfReach = useMemo(() => {
    const out = new Map<AbilityId, {why: string; note?: string}>();
    if (!fight || !acting?.alive) return out;
    const map = mapOf(fight);
    const taunter = taunterOf(fight, acting);
    const binds = taunter !== undefined && tauntBinds(fight, map, acting, taunter);
    for (const def of abilitiesOf(acting)) {
      if (def.id === 'hold' || offeredTargets(fight, map, acting, def).length > 0) continue;
      out.set(
        def.id,
        binds && def.targets(fight, map, acting, acting.hex!).length > 0
          ? {
              why: `Taunted by ${HEROES[taunter.hero].name}: attack it, or end the turn.`,
              note: 'Taunted',
            }
          : isPinned(acting) && def.targets(fight, map, acting, acting.hex!).length > 0
            ? {why: 'Pinned: abilities reach only the spaces next to you.', note: 'Pinned'}
            : def.id === 'bow' && acting.hex && obscured(fight, map, acting.hex)
              ? {why: 'Obscured: can’t shoot a bow.', note: 'Obscured'}
              : def.id === 'bow' &&
                  acting.hex &&
                  arrowLanes(fight, map, acting.hex).some(
                    (l) => l.hidden && l.hidden.side !== acting.side
                  )
                ? {
                    why: 'The enemies in the bow’s lanes are Obscured: arrows can’t reach them.',
                    note: 'Obscured',
                  }
                : {why: NO_TARGET[def.id] ?? 'Nothing to target from here.'}
      );
    }
    return out;
  }, [fight, acting]);

  /**
   * The move action's delay, before track yielding: the planned move's, or
   * the range over the hexes it can reach, so Move reads like an ability.
   */
  const moveSlots = useMemo(() => {
    if (!acting) return null;
    // The camel's move has a cost of its own (camel.md, 18.1).
    const slots = (hexes: number) =>
      slotsForward(
        HEROES[acting.hero].moveCost ?? turnCost(RULES.moveActionCost, hexes),
        acting.speed
      );
    const shown = plannedMove ?? hoverReach;
    if (shown && shown.path.length > 0) return `${slots(shown.path.length)}`;
    const lengths = reaches.map((r) => r.path.length).filter((n) => n > 0);
    if (lengths.length === 0) return null;
    const low = slots(Math.min(...lengths));
    const high = slots(Math.max(...lengths));
    return low === high ? `${low}` : `${low}–${high}`;
  }, [acting, plannedMove, hoverReach, reaches]);

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
    lungeFromHere,
    lungeSteps,
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
    moveSlots,
  };
}
