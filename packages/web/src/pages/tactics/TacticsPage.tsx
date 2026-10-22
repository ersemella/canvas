import {useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState} from 'react';
import {Alert, Button, Center, Loader, Paper, Stack, Text} from '@mantine/core';
import {
  hexDistance,
  hexEquals,
  hexKey,
  hexNeighbors,
  hexRing,
  hexToPixel,
  hexesInRange,
  registerBuiltinComponents,
  registerBuiltinSystems,
} from '@canvas/engine';
import type {EventBus, Hex} from '@canvas/engine';
import {
  ABILITIES,
  ABILITY,
  BOARD_LAYOUT,
  HEROES,
  HERO_PORTRAIT,
  RULES,
  SCENE_SIZE,
  abilitiesOf,
  actingUnit,
  arrowLanes,
  allowedTargets,
  atExit,
  camelOf,
  chooseAiTurn,
  hexOverlaySpan,
  mapOf,
  obscured,
  offeredTargets,
  onMap,
  plainSand,
  previewTurn,
  reachableHexes,
  slotsForward,
  trackCards,
  turnCost,
  taunterOf,
  unitAt,
  unusableReason,
} from '@canvas/games-silk-road-run';
import type {
  AbilityId,
  ActionTarget,
  BoardScene,
  FightState,
  HeroId,
  HighlightKind,
  Reach,
  TacticsCardPayload,
  TacticsHoverPayload,
  TacticsTapPayload,
  TurnInput,
  Unit,
} from '@canvas/games-silk-road-run';
import '@fontsource/jersey-20/400.css';
import {GameCanvas} from 'components/GameCanvas';
import {GameErrorBoundary} from 'components/GameErrorBoundary';
import {useIsPhone} from 'components/useIsPhone';
import {createModuleFor, findGame} from 'registry/games';
import {runsApi} from './runsApi';
import {StartMenu} from './StartMenu';
import type {RunResponse} from './runsApi';
import {AbilityIcon, abilityIcon} from './AbilityIcon';
import {HexTooltip} from './HexTooltip';
import {Glossary} from './Keywords';
import {
  AbilityDetail,
  HexInspector,
  PALETTE_VARS,
  RunMenu,
  SkipButton,
  nextTurn,
  StatSheet,
} from './TacticsPanels';
import styles from './TacticsPage.module.css';

/** Area abilities: their radius, to highlight the area around a chosen hex. */
const AREA_RADIUS: Partial<Record<AbilityId, number>> = {
  volley: ABILITY.volley.radius,
  freeze: ABILITY.freeze.radius,
  hail: 0,
};

/** Skip turn's turn: Hold, without moving. */
const SKIP: TurnInput = {action: {ability: 'hold', target: {}}};

/** Why an ability has nothing to target, when that disables it. */
const NO_TARGET: Partial<Record<AbilityId, string>> = {
  bow: 'No enemy in any of the bow’s lanes.',
  throw: 'No enemy next to you, or nowhere free to throw them.',
  pin: 'No enemy next to you, or a step away, to pin.',
  leap: 'Nowhere to land.',
  rampage: 'No way clear to rampage.',
};

/** Abilities that deal damage: aiming one shows the health of whoever it could hit. */
const isAttack = (id: AbilityId) => 'damage' in ABILITY[id] || 'damagePerSlot' in ABILITY[id];
/** Abilities that heal (Sunlight): aiming one shows your units' health and statuses. */
const isHeal = (id: AbilityId) => 'heal' in ABILITY[id];

/** Under the result: how the fight ended (camel.md, 18.2). */
function outcomeText(fight: FightState): string {
  const camel = camelOf(fight);
  if (fight.phase === 'won')
    return camel?.alive && camel.hex && atExit(fight, camel.hex)
      ? `${HEROES.camel.name} takes the road out.`
      : 'The rival band is scattered.';
  return camel && !camel.alive
    ? `${HEROES.camel.name} has fallen, and the load with it.`
    : 'Your caravan has fallen.';
}

/** Remembers, for this tab, that the start menu is open over the fight. */
const START_MENU_STORAGE = 'canvas:tactics:startMenu';

function savedStartMenu(): boolean {
  try {
    return sessionStorage.getItem(START_MENU_STORAGE) === '1';
  } catch {
    return false;
  }
}

/**
 * Silk Road Run: one fight against the AI (Phase 1). The run lives on
 * the server (a RunRoom); this page draws its view, previews turns with the
 * same rules locally (D11), and sends each turn as one request. Tapping or
 * hovering a hex shows what's there; Move, then a hex, plans the move;
 * an ability, then a target, previews that ability instead. Move and abilities
 * are separate actions; once its hex or target is picked, the picked button
 * confirms it. Skip turn ends the turn with Hold. On desktop a click on a
 * reachable hex plans a move without Move, a second click on the hex picked
 * last commits, and keys and a right-click do the rest (phase-1-brief.md).
 */
export function TacticsPage() {
  const [run, setRun] = useState<RunResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  /** The board is playing back what the last turn set off; the page waits for it. */
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The start menu, over the fight (New fight, Reset run) until a new one
  // starts; the run in progress is abandoned only then. A refresh keeps it open.
  const [startMenu, setStartMenuState] = useState(savedStartMenu);
  const setStartMenu = useCallback((open: boolean) => {
    setStartMenuState(open);
    try {
      if (open) sessionStorage.setItem(START_MENU_STORAGE, '1');
      else sessionStorage.removeItem(START_MENU_STORAGE);
    } catch {
      // storage blocked: a refresh shows the fight
    }
  }, []);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [plannedMove, setPlannedMove] = useState<Reach | null>(null);
  const [ability, setAbility] = useState<AbilityId | null>(null);
  const [target, setTarget] = useState<ActionTarget | null>(null);
  /**
   * Picking where to move, as an ability picks its target: taps on reachable
   * hexes plan (or change) the move, which stays open until Confirm; other taps inspect.
   */
  const [moving, setMoving] = useState(false);
  /** The hex last tapped to inspect (touch can't hover). */
  const [pinnedHex, setPinnedHex] = useState<Hex | null>(null);
  const [hover, setHover] = useState<TacticsHoverPayload>({hex: null, unitId: null});
  /** Phone widths (the CSS breakpoint): a pared-down action section pinned below the details. */
  /** Phone widths: layout only (the board edge to edge, details first, actions pinned below). */
  const phone = useIsPhone();
  const eventsRef = useRef<EventBus | null>(null);
  const boardRef = useRef<HTMLDivElement | null>(null);
  const actionsRef = useRef<HTMLElement | null>(null);
  /** The details and actions (the whole side panel on desktop): clicks there keep the inspected hex. */
  const panelRef = useRef<HTMLDivElement | null>(null);
  /** Phones: the action section's height during the fight, kept once it ends so the board stays put. */
  const actionsHeight = useRef(0);
  const [worldReady, setWorldReady] = useState(0);
  /** Phones: the space the board may fill, and the board's width to fill it. */
  const boardSlotRef = useRef<HTMLDivElement | null>(null);
  const [fitWidth, setFitWidth] = useState<number | null>(null);
  /** The canvas's size on screen, to place the phone's tooltip and desktop's Confirm over it. */
  const [boardSize, setBoardSize] = useState<{width: number; height: number} | null>(null);

  // A tap anywhere but the board or (on desktop) the side panel stops
  // inspecting, and the details go back to the unit whose turn it is. On a
  // phone that closes the tooltip: a tap on the action section does too
  // (the board decides for itself, and the tooltip closes itself). A click,
  // not a touch, so scrolling the details doesn't count. The click's path,
  // not its target: a tap can replace what it landed on (the tooltip growing).
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const path = e.composedPath();
      const inside = (el: Element | null) => el !== null && path.includes(el);
      if (inside(boardRef.current) || (!phone && inside(panelRef.current))) return;
      setPinnedHex(null);
      setSelectedId(null);
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, [phone]);

  // Phones: note the action section's tallest height while it holds the
  // turn's choices, to keep once the fight ends, so the board doesn't move.
  // (The camel's shorter turns keep it through `rows`.)
  useLayoutEffect(() => {
    const el = actionsRef.current;
    if (el?.querySelector('[data-testid="turn-controls"]'))
      actionsHeight.current = Math.max(actionsHeight.current, el.offsetHeight);
  });

  const fight: FightState | null = run?.view.fight ?? null;
  const fightRef = useRef(fight);
  fightRef.current = fight;

  // Follow the canvas's size on screen, to place the phone's tooltip and
  // desktop's Confirm over it.
  const hasBoard = fight !== null;
  useEffect(() => {
    const canvas = boardRef.current?.querySelector('canvas');
    if (!canvas) return;
    const observer = new ResizeObserver(() =>
      setBoardSize({width: canvas.offsetWidth, height: canvas.offsetHeight})
    );
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [phone, hasBoard]);

  // Phones: the board as large as the slot allows, width or height, keeping its shape.
  useEffect(() => {
    const slot = boardSlotRef.current;
    if (!phone || !slot) return;
    const observer = new ResizeObserver(() =>
      setFitWidth(
        Math.floor(
          Math.min(slot.clientWidth, (slot.clientHeight * SCENE_SIZE.width) / SCENE_SIZE.height)
        )
      )
    );
    observer.observe(slot);
    return () => observer.disconnect();
  }, [phone, hasBoard]);

  const resetTurn = useCallback(() => {
    setPlannedMove(null);
    setAbility(null);
    setTarget(null);
    setMoving(false);
  }, []);

  const receive = useCallback(
    (r: RunResponse) => {
      setRun(r);
      setStartMenu(false);
      resetTurn();
      setError(null);
    },
    [resetTurn, setStartMenu]
  );

  // Resume the key's active run, if any.
  useEffect(() => {
    runsApi
      .active()
      .then(({activeRunId}) => (activeRunId ? runsApi.get(activeRunId).then(setRun) : undefined))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const send = useCallback(
    async (request: () => Promise<RunResponse>, playback = true) => {
      setBusy(true);
      try {
        const before = fightRef.current;
        const r = await request();
        // Play back what the action set off (the player's turn, then the AI's).
        // A new run isn't played back: it starts from the start menu, with no board.
        if (playback && before && r.view.fight.events?.length && eventsRef.current) {
          setPlaying(true);
          eventsRef.current.emit('tactics:playback', {from: before, to: r.view.fight});
        }
        receive(r);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Something went wrong.');
      } finally {
        setBusy(false);
      }
    },
    [receive]
  );

  const startRun = useCallback(
    (party: HeroId[]) => void send(() => runsApi.start(party), false),
    [send]
  );

  // ── The acting unit's options ──────────────────────────────────────────────

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
    !phone && moveMode && !plannedMove && hover.hex
      ? reaches.find((r) => r.path.length > 0 && hexEquals(r.hex, hover.hex!))
      : undefined;

  // Ability targets always come from the unit's current position.
  const abilityContext = useMemo(
    () => (fight && acting ? {state: fight, unit: acting} : null),
    [fight, acting]
  );

  /** What the chosen ability may target (under a binding taunt, only what affects the taunter). */
  const targets = useMemo(() => {
    if (!ability || !abilityContext || !abilityContext.unit.alive) return [];
    return offeredTargets(
      abilityContext.state,
      mapOf(abilityContext.state),
      abilityContext.unit,
      ABILITIES[ability]
    );
  }, [ability, abilityContext]);

  /**
   * Pin's options on a unit: pinning it from where the Champion stands, and
   * the hexes it may step to first (2026-10-21).
   */
  const pinFromHere = useCallback(
    (h: Hex) => targets.some((t) => !t.to && t.hex && hexEquals(t.hex, h)),
    [targets]
  );
  const pinSteps = useCallback(
    (h: Hex) => targets.filter((t) => t.to && t.hex && hexEquals(t.hex, h)),
    [targets]
  );

  /** The action with its target chosen, ready to preview. */
  const action = useMemo(() => {
    if (!ability || !target) return null;
    if (ability === 'throw' && !target.to) return null;
    // A unit a Pin can't reach from here needs its step picked.
    if (ability === 'pin' && !target.to && !pinFromHere(target.hex!)) return null;
    return {ability, target};
  }, [ability, target, pinFromHere]);

  /** What Move or the chosen ability still needs picked on the board: its button says so. */
  const needsTarget =
    moving && !plannedMove
      ? 'Pick where to move'
      : ability && !action
        ? ability === 'throw' && target?.hex
          ? 'Pick where to throw'
          : ability === 'pin' && target?.hex
            ? 'Pick where to step'
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

  const commit = useCallback(
    (turn: TurnInput | null = input) => {
      if (!run || !turn || busy || playing) return;
      void send(() => runsApi.turn(run.runId, turn));
    },
    [run, input, send, busy, playing]
  );

  /** On to the run's next stage, once this one is won: a new board, nothing to play back. */
  const nextStage = useCallback(() => {
    if (!run || busy) return;
    setPinnedHex(null);
    setSelectedId(null);
    void send(() => runsApi.next(run.runId), false);
  }, [run, send, busy]);

  const clearMove = useCallback(() => {
    setPlannedMove(null);
    setMoving(false);
  }, []);

  /** Selecting an ability replaces any planned move. */
  const chooseAbility = useCallback(
    (id: AbilityId | null) => {
      clearMove();
      setAbility(id);
      setMoving(false);
      if (!id) return setTarget(null);
      // Abilities with no target (Hold) preview at once.
      const own = abilityContext
        ? ABILITIES[id].targets(
            abilityContext.state,
            mapOf(abilityContext.state),
            abilityContext.unit,
            abilityContext.unit.hex!
          )
        : [];
      setTarget(own.length === 1 && own[0]!.hex === undefined ? {} : null);
    },
    [abilityContext, clearMove]
  );

  const chooseTarget = useCallback(
    (t: ActionTarget) => {
      clearMove();
      setTarget(t);
    },
    [clearMove]
  );

  /**
   * Move replaces the selected ability. Toggling it off undoes the move.
   */
  const toggleMove = useCallback(() => {
    if (plannedMove || moving) return clearMove();
    setAbility(null);
    setTarget(null);
    setMoving(true);
  }, [moving, plannedMove, clearMove]);

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
   * why: disabled. Under a binding taunt that's anything that can't affect the taunter.
   */
  const outOfReach = useMemo(() => {
    const out = new Map<AbilityId, string>();
    if (!acting || !abilityContext?.unit.alive) return out;
    const {state, unit} = abilityContext;
    const map = mapOf(state);
    for (const def of abilitiesOf(acting)) {
      if (def.id === 'hold' || offeredTargets(state, map, unit, def).length > 0) continue;
      const taunter = taunterOf(state, unit);
      out.set(
        def.id,
        taunter &&
          def.targets(state, map, unit, unit.hex!).length > 0 &&
          allowedTargets(state, map, unit, def).length === 0
          ? `Taunted: this can’t reach ${HEROES[taunter.hero].name}.`
          : def.id === 'bow' && unit.hex && obscured(state, map, unit.hex)
            ? 'Can’t shoot out of a sandstorm.'
            : (NO_TARGET[def.id] ?? 'Nothing to target from here.')
      );
    }
    return out;
  }, [acting, abilityContext]);

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

  // ── Taps on the board ──────────────────────────────────────────────────────

  const onHex = useCallback(
    (h: Hex) => {
      // A tap during a playback skips to its end.
      if (playing) {
        eventsRef.current?.emit('tactics:playback-skip', {});
        return;
      }
      if (!fight || busy) return;
      // A tap that plans the turn (a hex to move to, a target) closes a
      // phone's tooltip, as any tap outside it does.
      const planned = () => {
        if (!phone) return;
        setPinnedHex(null);
        setSelectedId(null);
      };
      // Desktop: a second click on the hex just picked (the destination, the
      // target, or Throw's landing or Pin's step) commits the turn. Phones
      // un-pick it instead: there the board is only for looking and aiming.
      const lastPicked = plannedMove?.hex ?? target?.to ?? target?.hex ?? null;
      if (!phone && input && preview && lastPicked && hexEquals(lastPicked, h)) {
        commit();
        return;
      }
      if (acting && moveMode) {
        const reach = reaches.find((r) => r.path.length > 0 && hexEquals(r.hex, h));
        if (reach) {
          // Tapping the chosen hex again un-picks it (Move's button confirms).
          setPlannedMove(plannedMove && hexEquals(plannedMove.hex, h) ? null : reach);
          planned();
          return;
        }
      } else if (acting && ability) {
        if ((ability === 'throw' || ability === 'pin') && target?.hex) {
          // Throw's landing, or the hex a Pin steps to first.
          const second = targets.find(
            (t) => hexEquals(t.hex!, target.hex!) && t.to && hexEquals(t.to, h)
          );
          if (second) {
            // Tapping the chosen hex again un-picks it (the button confirms).
            if (!target.to || !hexEquals(target.to, h)) chooseTarget(second);
            else setTarget({hex: target.hex});
            planned();
            return;
          }
          // Tapping the Champion drops the step, if it can pin from where it stands.
          if (
            ability === 'pin' &&
            target.to &&
            acting.hex &&
            hexEquals(acting.hex, h) &&
            pinFromHere(target.hex)
          ) {
            chooseTarget({hex: target.hex});
            planned();
            return;
          }
        }
        const match = targets.find((t) => t.hex && hexEquals(t.hex, h));
        if (match) {
          // Tapping the chosen target again un-picks it (the button confirms).
          if (target?.hex && hexEquals(target.hex, h)) setTarget(null);
          else if (ability === 'throw') chooseTarget({hex: h});
          else if (ability === 'pin') {
            // From here if it can; otherwise its only step, or a step still to pick.
            const steps = pinSteps(h);
            chooseTarget(!pinFromHere(h) && steps.length === 1 ? steps[0]! : {hex: h});
          } else chooseTarget(match);
          planned();
          return;
        }
      }
      // Anything else: look at the hex, or stop looking at it if it's the one
      // being looked at (on a small phone, the board may be all there is to tap).
      // Plain sand has nothing to show: tapping it is tapping away.
      if ((pinnedHex && hexEquals(pinnedHex, h)) || plainSand(fight, mapOf(fight), h)) {
        setPinnedHex(null);
        setSelectedId(null);
        return;
      }
      setPinnedHex(h);
      setSelectedId(unitAt(fight, h)?.id ?? null);
    },
    [
      fight,
      busy,
      playing,
      phone,
      acting,
      moveMode,
      reaches,
      plannedMove,
      ability,
      target,
      targets,
      chooseTarget,
      pinFromHere,
      pinSteps,
      pinnedHex,
      input,
      preview,
      commit,
    ]
  );

  /**
   * Desktop: Esc or a right-click steps back once: the step or landing
   * picked last, then the target or destination, then the ability or Move,
   * then whatever is being looked at.
   */
  const stepBack = useCallback(() => {
    if (target?.to) setTarget({hex: target.hex!});
    else if (target?.hex) setTarget(null);
    else if (ability) chooseAbility(null);
    else if (plannedMove) setPlannedMove(null);
    else if (moving) setMoving(false);
    else {
      setPinnedHex(null);
      setSelectedId(null);
    }
  }, [target, ability, plannedMove, moving, chooseAbility]);

  // Desktop keys: 1–9 press the turn's buttons in order (Move first), Enter
  // or Space confirms what's picked, Esc steps back (Skip turn has S).
  useEffect(() => {
    if (phone) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      if (el?.closest('input, textarea, [contenteditable="true"]')) return;
      if (e.key === 'Escape') return stepBack();
      if (e.key === 'Enter' || e.key === ' ') {
        // A focused button or menu item answers these keys itself.
        if (el?.closest('button, a, [role="menuitem"]')) return;
        e.preventDefault();
        if (input && preview) commit();
        return;
      }
      const n = Number(e.key);
      if (Number.isInteger(n) && n >= 1) {
        const buttons = actionsRef.current?.querySelectorAll<HTMLButtonElement>('[data-choice]');
        buttons?.[n - 1]?.click();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [phone, stepBack, input, preview, commit]);

  // Desktop: the right button steps back, and never reaches the board as a click.
  useEffect(() => {
    const board = boardRef.current;
    if (phone || !board) return;
    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) e.stopPropagation();
    };
    const onMenu = (e: MouseEvent) => {
      e.preventDefault();
      stepBack();
    };
    board.addEventListener('pointerdown', onDown, true);
    board.addEventListener('pointerup', onDown, true);
    board.addEventListener('contextmenu', onMenu);
    return () => {
      board.removeEventListener('pointerdown', onDown, true);
      board.removeEventListener('pointerup', onDown, true);
      board.removeEventListener('contextmenu', onMenu);
    };
  }, [phone, stepBack, hasBoard]);

  // A hex looked at that a turn left with nothing on it (its unit moved
  // away, fell or was pushed off) stops being looked at.
  useEffect(() => {
    if (fight && pinnedHex && plainSand(fight, mapOf(fight), pinnedHex)) {
      setPinnedHex(null);
      setSelectedId(null);
    }
  }, [fight, pinnedHex]);

  /** The phone's tooltip stops above the pinned action bar. */
  const tooltipFloor = useCallback(() => actionsRef.current?.getBoundingClientRect().top, []);

  const onHexRef = useRef(onHex);
  onHexRef.current = onHex;

  // ── What the board draws ───────────────────────────────────────────────────

  /** The hex being looked at: under the mouse (unless it's plain sand), else the one last tapped. */
  const hoverHex =
    fight && hover.hex && !plainSand(fight, mapOf(fight), hover.hex) ? hover.hex : null;
  const inspectHex = hoverHex ?? pinnedHex;
  const inspectedUnit = fight && inspectHex ? unitAt(fight, inspectHex) : undefined;
  /**
   * On a phone, the unit the details feature (the one on the inspected hex,
   * else the tapped or acting one) shows its health and statuses on the board.
   */
  const featuredId = phone
    ? ((inspectHex ? inspectedUnit?.id : (selectedId ?? acting?.id)) ?? null)
    : null;

  const scene: BoardScene = useMemo(() => {
    const highlights: {hex: Hex; kind: HighlightKind}[] = [];
    const out: BoardScene = {
      fight,
      highlights,
      selectedUnitId: selectedId ?? acting?.id ?? null,
      inspectedUnitId: phone ? featuredId : selectedId,
      // Phones show whose turn it is in the action bar instead (see `TurnControls`).
      turnArrow: !phone,
      preview: [],
      previewSlot: preview?.slot ?? null,
      aimSlot: preview?.aimSlot ?? null,
    };
    if (!fight) return out;
    if (!acting) return out;
    if (ability && (isAttack(ability) || isHeal(ability))) {
      // An attack: every enemy, and the allies in the line of fire. A heal,
      // the other way round: every ally. Either way, those it can target
      // (the units the bow's lanes reach, a melee ability's neighbours, the
      // units in a heal's range) and those the aimed ability would hurt or heal.
      const heals = isHeal(ability);
      const side = heals ? 'player' : 'enemy';
      const ids = new Set(fight.units.filter((u) => u.side === side).map((u) => u.id));
      if (ABILITIES[ability].targetsUnit && abilityContext)
        for (const t of targets) {
          const u = t.hex && unitAt(abilityContext.state, t.hex);
          if (u) ids.add(u.id);
        }
      for (const c of preview?.changes ?? [])
        if (heals ? c.hpAfter > c.hpBefore : c.hpAfter < c.hpBefore) ids.add(c.unitId);
      out.healthUnitIds = [...ids];
    }
    if (moveMode && !moving && !plannedMove) {
      // Desktop, nothing picked: only the hex under the mouse, if it can be
      // reached, and the way there, so the board stays clear; the bounds of
      // where the unit can move, outlined as an ability's range is.
      if (hoverReach && acting.hex) {
        for (const h of hoverReach.path.slice(0, -1)) highlights.push({hex: h, kind: 'path'});
        highlights.push({hex: hoverReach.hex, kind: 'target'});
        out.path = [acting.hex, ...hoverReach.path];
        out.range = filledIn(
          acting.hex,
          reaches.map((r) => r.hex)
        );
      }
    } else if (moveMode) {
      // Like an ability's targets: every reachable hex stays open to pick,
      // the planned one chosen and the steps on the way to it marked.
      const onPath = (h: Hex) => plannedMove?.path.some((p) => hexEquals(p, h));
      if (moving)
        for (const r of reaches)
          if (r.path.length > 0 && !onPath(r.hex)) highlights.push({hex: r.hex, kind: 'target'});
      if (plannedMove) {
        for (const h of plannedMove.path.slice(0, -1)) highlights.push({hex: h, kind: 'path'});
        highlights.push({hex: plannedMove.hex, kind: 'chosen'});
        if (acting.hex) out.path = [acting.hex, ...plannedMove.path];
      }
    } else if (ability) {
      // How far it reaches, outlined; the bow's lanes, an arrow along each to
      // an enemy it can hit, so it's plain why the others can't be.
      const def = ABILITIES[ability];
      const from = acting.hex;
      if (from && def.range) {
        const map = mapOf(fight);
        out.range = hexesInRange(from, def.range).filter(
          (h) => hexDistance(h, from) <= def.range! && onMap(map, h)
        );
      }
      if (from && ability === 'bow')
        out.lanes = {
          from,
          lanes: arrowLanes(fight, mapOf(fight), from).map((l) => ({
            hexes: l.hexes,
            target: targets.some((t) => t.hex && l.hit?.hex && hexEquals(t.hex, l.hit.hex)),
          })),
        };
      // Only what it may target; once Throw's target is picked, where it can
      // land; once Pin's is, the hexes it may step to first as well. Those
      // second picks are dashed, as is a unit Pin reaches only after a step,
      // so they never read as more targets.
      const shown = new Set<string>();
      const throwing = ability === 'throw' && target?.hex;
      const stepping = ability === 'pin' && target?.hex;
      for (const t of targets) {
        const at = throwing ? (hexEquals(t.hex!, target!.hex!) ? t.to : undefined) : t.hex;
        const step = stepping && t.to && hexEquals(t.hex!, target!.hex!) ? t.to : undefined;
        for (const h of [at, step]) {
          if (!h || shown.has(hexKey(h))) continue;
          shown.add(hexKey(h));
          const kind =
            throwing || h === step
              ? 'landing'
              : ability === 'pin' && !pinFromHere(h)
                ? 'reach'
                : 'target';
          highlights.push({hex: h, kind});
        }
      }
      // Where the second pick goes: the one hovered, else the one picked.
      // Before Pin's target is, a hovered unit it reaches by a single step.
      const hovered = hover.hex;
      const hoveredSecond =
        hovered && target?.hex
          ? targets.find((t) => t.to && hexEquals(t.hex!, target.hex!) && hexEquals(t.to, hovered))
              ?.to
          : undefined;
      let second = hoveredSecond ?? target?.to;
      if (!second && !target && ability === 'pin' && hovered && !pinFromHere(hovered)) {
        const steps = pinSteps(hovered);
        if (steps.length === 1) second = steps[0]!.to;
      }
      // Throw: an arc from the unit thrown, around the Champion, to where it
      // lands. Pin: the Champion's step, drawn as a move's.
      if (ability === 'throw' && target?.hex && second && from)
        out.arc = {from: target.hex, around: from, to: second};
      if (ability === 'pin' && second && from) out.step = [from, second];
      if (target?.hex) {
        const radius = AREA_RADIUS[ability];
        if (radius) {
          const map = mapOf(fight);
          for (const h of hexesInRange(target.hex, radius))
            if (hexDistance(h, target.hex) <= radius && onMap(map, h))
              highlights.push({hex: h, kind: 'area'});
        }
        highlights.push({hex: target.hex, kind: 'chosen'});
        if (target.to) highlights.push({hex: target.to, kind: 'chosen'});
      }
    }
    if (preview) {
      out.preview = preview.changes.map((c) => ({
        unitId: c.unitId,
        to: c.to,
        hpAfter: c.hpAfter,
        hpBefore: c.hpBefore,
        killed: c.killed,
      }));
    } else if (plannedMove) {
      out.preview = [
        {
          unitId: acting.id,
          to: plannedMove.hex,
          hpAfter: acting.hp,
          hpBefore: acting.hp,
          killed: false,
        },
      ];
    }
    return out;
  }, [
    fight,
    selectedId,
    phone,
    featuredId,
    acting,
    plannedMove,
    moving,
    moveMode,
    hoverReach,
    ability,
    action,
    reaches,
    targets,
    target,
    preview,
    abilityContext,
    hover.hex,
    pinFromHere,
    pinSteps,
  ]);

  useEffect(() => {
    eventsRef.current?.emit('tactics:board', scene);
  }, [scene, worldReady]);

  // ── The canvas ─────────────────────────────────────────────────────────────

  const game = useMemo(() => {
    registerBuiltinSystems();
    registerBuiltinComponents();
    const definition = findGame('silk-road-run')!;
    const module = createModuleFor(definition);
    module.register();
    return {sceneData: module.getSceneData(), createSystems: () => module.getSystems()};
  }, []);

  const onReady = useCallback((events: EventBus) => {
    eventsRef.current = events;
    events.on<TacticsTapPayload>('tactics:tap', ({hex}) => onHexRef.current(hex));
    // A track card's unit, in place of any hex looked at before (which
    // would otherwise win, and may since have emptied).
    events.on<TacticsCardPayload>('tactics:card', ({unitId}) => {
      setPinnedHex(null);
      setSelectedId(unitId);
    });
    events.on<TacticsHoverPayload>('tactics:hover', setHover);
    events.on('tactics:playback-done', () => setPlaying(false));
    setWorldReady((n) => n + 1);
  }, []);

  // Dev-server hooks for the e2e suite (scripts/e2e/tactics.e2e.mjs).
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    (window as unknown as {__tactics?: unknown}).__tactics = {
      run,
      busy: busy || playing,
      hexToCanvas: (h: Hex) => hexToPixel(h, BOARD_LAYOUT),
      /** The middle of the strip of a unit's track card that shows, in scene pixels. */
      cardCenter: (unitId: string) => {
        const c =
          fight && trackCards(fight, preview?.slot ?? null).find((t) => t.unitId === unitId);
        return c ? {x: c.x + c.w / 2, y: c.y + c.h / 2} : null;
      },
      /** What a looked-at hex takes up (its unit's health bar and statuses included), in scene pixels. */
      overlaySpan: (h: Hex) => (fight ? hexOverlaySpan(fight, h) : null),
      /** The chosen ability's targets and the acting unit's moves, since starts are random. */
      targets,
      reaches,
      autoTurn: () => {
        if (!fight || !acting) return false;
        commit(chooseAiTurn(fight, acting));
        return true;
      },
    };
  }, [run, busy, playing, fight, acting, commit, targets, reaches, preview]);

  // ── Layout ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <Center h="100dvh">
        <Loader size="sm" />
      </Center>
    );
  }

  if (!run || !fight || run.status === 'abandoned' || startMenu) {
    return (
      <StartMenu
        busy={busy}
        error={error}
        onStart={startRun}
        {...(startMenu && run && fight ? {onBack: () => setStartMenu(false)} : {})}
      />
    );
  }

  // The result waits for the playback to show how the fight ended.
  const finished = (fight.phase === 'won' || fight.phase === 'lost') && !playing;
  const {stage, stages} = run.view;
  /** A stage short of the run's last, won: the next one waits. */
  const nextAhead = fight.phase === 'won' && stage < stages - 1;
  const selected =
    fight.units.find((u) => u.id === (hover.unitId ?? selectedId ?? acting?.id)) ?? null;

  // The action section (the turn) and the detail section
  // (what's tapped or hovered). Phones show the details in a tooltip over
  // the board and pin the actions to the bottom of the screen.
  const menu = <RunMenu busy={busy || playing} onReset={() => setStartMenu(true)} />;
  // Phones: the turn portrait opens the acting unit's details, as its track
  // card does; a second tap closes them. (Desktop shows the portrait of the
  // unit in focus in the details instead.)
  const lookingAtActing = Boolean(
    acting?.hex && (pinnedHex ? hexEquals(pinnedHex, acting.hex) : selectedId === acting.id)
  );
  const lookAtActing = () => {
    setPinnedHex(null);
    setSelectedId(!lookingAtActing ? (acting?.id ?? null) : null);
  };
  // Once the fight is over, Next stage (a stage before the run's last won)
  // or New fight takes Confirm's place, and the section keeps its height so
  // the board doesn't move.
  const actions = finished ? (
    <div className={styles.confirmRow}>
      {nextAhead ? (
        <Button size="lg" className={styles.seal!} fw="bold" loading={busy} onClick={nextStage}>
          Next stage
        </Button>
      ) : (
        <Button size="lg" className={styles.seal!} fw="bold" onClick={() => setStartMenu(true)}>
          New fight
        </Button>
      )}
      {menu}
    </div>
  ) : (
    acting && (
      <TurnControls
        slotsLater={slotsLater}
        moveSlots={moveSlots}
        outOfReach={outOfReach}
        unit={acting}
        ability={ability}
        plannedMove={plannedMove}
        moving={moving}
        canMove={reaches.some((r) => r.path.length > 0) || plannedMove !== null}
        waiting={busy || playing}
        // Phones keep room for the party's most rows, so the board stays put.
        rows={
          phone
            ? Math.max(...fight.units.filter((u) => u.side === 'player').map(choiceRows))
            : choiceRows(acting)
        }
        keys={!phone}
        needsTarget={needsTarget}
        confirm={input ? (nextTurn(fight, preview) ?? {text: '', blocked: true}) : null}
        onMove={toggleMove}
        onAbility={chooseAbility}
        onConfirm={() => commit()}
        menu={menu}
        // Desktop: the details show the unit's portrait instead.
        onPortrait={phone ? lookAtActing : undefined}
        portraitOpen={lookingAtActing}
      >
        <SkipButton
          // A new turn (or unit) starts it disarmed.
          key={`${acting.id}@${fight.currentSlot}`}
          fight={fight}
          preview={skipPreview}
          busy={busy || playing}
          onSkip={() => commit(SKIP)}
          size={phone ? 'lg' : 'sm'}
          hotkey={phone ? undefined : 's'}
        />
      </TurnControls>
    )
  );
  // Phones: the details are a tooltip over the board, beside the tapped hex
  // (or the unit whose track card was tapped); none while a turn plays back.
  const tooltipHex =
    pinnedHex ?? (selectedId ? fight.units.find((u) => u.id === selectedId)?.hex : null) ?? null;
  // Never for a hex with nothing on it: an empty box.
  const tooltip = phone &&
    tooltipHex &&
    !plainSand(fight, mapOf(fight), tooltipHex) &&
    boardSize &&
    !playing &&
    !finished && (
      <HexTooltip
        key={hexKey(tooltipHex)}
        fight={fight}
        hex={tooltipHex}
        boardSize={boardSize}
        floor={tooltipFloor}
        onDismiss={() => {
          setPinnedHex(null);
          setSelectedId(null);
        }}
      />
    );
  const details = inspectHex ? (
    <HexInspector fight={fight} hex={inspectHex} />
  ) : (
    selected && <StatSheet fight={fight} unit={selected} />
  );
  // Desktop: the picked turn's Confirm beside the hex picked last, so the
  // turn is confirmed where the eyes are (a second click on the hex does too).
  const lastPicked = plannedMove?.hex ?? target?.to ?? target?.hex ?? null;
  const boardConfirm = !phone && input && lastPicked && boardSize && !busy && !playing && (
    <BoardConfirm
      hex={lastPicked}
      boardSize={boardSize}
      text={nextTurn(fight, preview)?.text ?? null}
      onConfirm={() => commit()}
    />
  );
  // Desktop: the chosen ability explained, at the foot of the panel.
  const chosen = acting && ability && (
    <Paper className={styles.plaque!} p="sm" data-testid="chosen-ability">
      <Glossary>
        <AbilityDetail unit={acting} def={ABILITIES[ability]} />
      </Glossary>
    </Paper>
  );

  return (
    <Stack
      className={styles.page!}
      style={PALETTE_VARS}
      align="center"
      pt={phone ? 0 : 'sm'}
      pb={phone ? 0 : 'sm'}
      gap="sm"
      px="md"
    >
      <div className={styles.layout}>
        <div className={styles.boardSlot} ref={boardSlotRef}>
          <div
            className={styles.board}
            ref={boardRef}
            style={phone && fitWidth ? {width: fitWidth} : undefined}
          >
            <GameErrorBoundary>
              <GameCanvas
                sceneData={game.sceneData}
                createSystems={game.createSystems}
                width={SCENE_SIZE.width}
                height={SCENE_SIZE.height}
                onReady={onReady}
              />
            </GameErrorBoundary>
            {tooltip}
            {boardConfirm}
            {finished && (
              <Paper className={`${styles.result} ${styles.plaque}`} p="lg">
                <Stack align="center" gap="xs">
                  <Text
                    className={styles.display!}
                    fz="1.8rem"
                    fw="bold"
                    c={fight.phase === 'won' ? 'var(--c-goldLight)' : 'var(--c-madderLight)'}
                  >
                    {fight.phase === 'won' ? 'Victory' : 'Defeat'}
                  </Text>
                  <Text c="dimmed" fz="sm">
                    {outcomeText(fight)}
                  </Text>
                  <Text c="dimmed" fz="xs" data-testid="stage">
                    {nextAhead
                      ? `Stage ${stage + 1} of ${stages} won. A bigger band waits down the road.`
                      : `Stage ${stage + 1} of ${stages}`}
                  </Text>
                </Stack>
              </Paper>
            )}
          </div>
        </div>
        <div className={styles.panel} ref={panelRef}>
          {error && (
            <Alert color="red" py={6} withCloseButton onClose={() => setError(null)}>
              {error}
            </Alert>
          )}
          {phone ? (
            <section
              className={styles.actionBar}
              ref={actionsRef}
              style={{minHeight: actionsHeight.current || undefined}}
            >
              {actions}
            </section>
          ) : (
            <>
              <section ref={actionsRef}>{actions}</section>
              {details}
              <div className={styles.panelFoot}>
                {chosen}
                {!finished && (
                  <Text className={styles.keysHint!} data-testid="keys-hint">
                    Click a hex to move or aim, and again to go. Esc or right-click steps back.
                  </Text>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </Stack>
  );
}

/** The abilities a unit's turn offers as buttons: no Hold, since Confirm reads End turn with no action picked. */
function choiceAbilities(unit: Unit) {
  return abilitiesOf(unit).filter((def) => def.id !== 'hold');
}

/**
 * Move and the abilities in rows of two, or three for a hero with more to
 * choose from; Move alone (the camel) fills the row.
 */
function choiceColumns(unit: Unit): number {
  const choices = choiceAbilities(unit).length + 1;
  return choices === 1 ? 1 : choices > 4 ? 3 : 2;
}

/** The rows a unit's choices take. */
function choiceRows(unit: Unit): number {
  return Math.ceil((choiceAbilities(unit).length + 1) / choiceColumns(unit));
}

/**
 * `hexes` (all near `from`) with the holes in them filled: allies, ruins and
 * the like a move can't end on but stand inside its reach, so only the
 * outer bounds get outlined.
 */
function filledIn(from: Hex, hexes: Hex[]): Hex[] {
  const inside = new Set(hexes.map(hexKey));
  const radius = Math.max(0, ...hexes.map((h) => hexDistance(h, from))) + 1;
  // Whatever the ring just outside them reaches without crossing them is outside.
  const outside = new Set<string>();
  let frontier = hexRing(from, radius);
  for (const h of frontier) outside.add(hexKey(h));
  while (frontier.length > 0) {
    const next: Hex[] = [];
    for (const h of frontier)
      for (const n of hexNeighbors(h)) {
        const key = hexKey(n);
        if (hexDistance(n, from) > radius || inside.has(key) || outside.has(key)) continue;
        outside.add(key);
        next.push(n);
      }
    frontier = next;
  }
  return hexesInRange(from, radius).filter((h) => !outside.has(hexKey(h)));
}

/**
 * The turn's choices, the same on phones and desktop: Move and the
 * abilities as big buttons (the name, then the cost in slots), in rows of
 * two, or three for a hero with more to choose from; then Skip turn,
 * filling its row beside the run's menu. The picked one asks for its hex
 * or target, then, once it's picked, becomes its Confirm: players tap the
 * button they picked again to go (owner, 2026-10-21).
 */
function TurnControls(props: {
  /** What an ability of this cost takes in slots, before yielding. */
  slotsLater: (actionCost: number) => number;
  /** The move action's cost in slots (a range until a hex is picked), shown in the Move button. */
  moveSlots: string | null;
  /** Abilities with nothing to target, and why: disabled (unless already chosen, so they can be put down). */
  outOfReach: Map<AbilityId, string>;
  unit: Unit;
  ability: AbilityId | null;
  plannedMove: Reach | null;
  moving: boolean;
  canMove: boolean;
  /**
   * A turn is being sent or played back (the empty slots and the enemies'
   * turns before this unit's): every choice is disabled until it's this
   * unit's turn on the board too.
   */
  waiting: boolean;
  /**
   * Rows of choices to make room for: the party's most, so the camel's turn
   * (Move alone, and it acts first) doesn't shrink the section and move the board.
   */
  rows: number;
  /** What the picked choice still needs picked on the board, if anything: its button says so. */
  needsTarget: string | null;
  /**
   * The picked choice is ready: its button confirms it, saying when the
   * next turn comes (`blocked` when the rules refuse it).
   */
  confirm: {text: string; title?: string; blocked?: boolean} | null;
  onMove: () => void;
  onAbility: (id: AbilityId | null) => void;
  onConfirm: () => void;
  /** The run's menu, beside Skip turn. */
  menu: React.ReactNode;
  /**
   * The unit's portrait before Skip turn, to say whose turn it is (on a
   * phone, the board's arrow over it read as "tap here"); a tap on it looks at the unit.
   */
  onPortrait?: (() => void) | undefined;
  /** The unit's details are showing (its portrait reads as pressed). */
  portraitOpen?: boolean;
  /** Desktop: each choice shows its number key. */
  keys?: boolean;
  children?: React.ReactNode;
}) {
  const {unit, ability, plannedMove, moving, confirm} = props;
  const defs = choiceAbilities(unit);
  // The picked button: Confirm once it's ready, else what it still needs.
  const confirmLabel = confirm && (
    <span className={styles.bigButton}>
      <span className={styles.tileName}>{confirm.blocked ? 'Can’t do that' : 'Confirm'}</span>
      <span className={styles.bigButtonCost}>{confirm.text}</span>
    </span>
  );
  const asking = (name: string, icon: React.ReactNode) => (
    <span className={styles.bigButton}>
      <span className={styles.tileName}>
        {icon}
        {name}
      </span>
      <span className={styles.bigButtonCost}>{props.needsTarget}</span>
    </span>
  );
  // A locked ultimate's charge goes on the cost's line, so a narrow tile
  // (three to a row) keeps its name on one line.
  const label = (name: string, cost: string, icon: React.ReactNode, note?: string) => (
    <span className={styles.bigButton}>
      <span className={styles.tileName}>
        {icon}
        {name}
      </span>
      <span className={styles.bigButtonCost}>
        {note && `${note} · `}
        {cost}
      </span>
    </span>
  );
  return (
    <Stack gap={8} data-testid="turn-controls">
      {/* One choice per turn: Move or an ability, picked like any other. */}
      <div
        className={styles.abilityGrid}
        style={
          {
            '--rows': props.rows,
            gridTemplateColumns: `repeat(${choiceColumns(unit)}, 1fr)`,
            minHeight: `calc(${props.rows} * var(--tile-height) + ${props.rows - 1} * var(--tile-gap))`,
          } as React.CSSProperties
        }
      >
        <Button
          size="lg"
          className={`${styles.tile} ${plannedMove && confirm ? styles.tileConfirm : ''}`}
          disabled={!props.canMove || props.waiting || Boolean(plannedMove && confirm?.blocked)}
          data-choice="move"
          data-key={props.keys ? 1 : undefined}
          aria-pressed={moving || plannedMove !== null}
          title={
            props.waiting
              ? 'Not this unit’s turn yet'
              : plannedMove
                ? (confirm?.title ?? 'Move there; tap the hex again to pick another')
                : moving
                  ? 'Pick where to move, or tap to put Move down'
                  : props.canMove
                    ? 'Move instead of using an ability; units block the path'
                    : 'Can’t move now'
          }
          onClick={plannedMove && confirm ? props.onConfirm : props.onMove}
        >
          {plannedMove && confirmLabel
            ? confirmLabel
            : moving && !plannedMove
              ? asking('Move', <AbilityIcon id="move" />)
              : label(
                  'Move',
                  props.moveSlots !== null ? `+${props.moveSlots}` : '',
                  <AbilityIcon id="move" />
                )}
        </Button>
        {defs.map((def, i) => {
          const reason =
            unusableReason(unit, def) ??
            (ability !== def.id ? (props.outOfReach.get(def.id) ?? null) : null);
          const lockedUlt =
            def.ultimate && !unit.ultimateUsed && unit.ultimateCharge < RULES.ultimateCharge;
          const picked = ability === def.id;
          const ready = picked && confirm !== null;
          return (
            <Button
              key={def.id}
              size="lg"
              className={`${styles.tile} ${def.ultimate ? styles.tileUltimate : ''} ${ready ? styles.tileConfirm : ''}`}
              disabled={reason !== null || props.waiting || Boolean(ready && confirm?.blocked)}
              data-choice={def.id}
              data-key={props.keys ? i + 2 : undefined}
              aria-pressed={picked}
              title={
                props.waiting
                  ? 'Not this unit’s turn yet'
                  : ready
                    ? (confirm?.title ?? `${def.name} there; tap the target again to pick another`)
                    : picked
                      ? `Pick a target, or tap to put ${def.name} down`
                      : (reason ?? def.summary(unit))
              }
              onClick={ready ? props.onConfirm : () => props.onAbility(picked ? null : def.id)}
            >
              {/* Its own cost in slots; once picked and aimed, Confirm, with any yielding. */}
              {ready && confirmLabel
                ? confirmLabel
                : picked
                  ? asking(def.name, abilityIcon(def))
                  : label(
                      def.name,
                      `+${props.slotsLater(def.cost)}`,
                      abilityIcon(def),
                      lockedUlt ? `${unit.ultimateCharge}/${RULES.ultimateCharge}` : undefined
                    )}
            </Button>
          );
        })}
      </div>
      <div className={styles.confirmRow}>
        {props.onPortrait && (
          <UnitPortrait unit={unit} open={Boolean(props.portraitOpen)} onTap={props.onPortrait} />
        )}
        {props.children}
        {props.menu}
      </div>
    </Stack>
  );
}

/**
 * A unit's portrait, framed like its track card (its hero's letter if it has
 * none): a tap looks at the unit, as its card does.
 */
function UnitPortrait(props: {unit: Unit; open: boolean; onTap: () => void}) {
  const src = HERO_PORTRAIT[props.unit.hero]?.src;
  const name = HEROES[props.unit.hero].name;
  return (
    <button
      type="button"
      className={styles.portrait}
      title={name}
      aria-label={`Look at ${name}`}
      aria-pressed={props.open}
      data-testid="turn-portrait"
      onClick={(e) => {
        // Not a tap away, which would close the details it opens.
        e.stopPropagation();
        props.onTap();
      }}
    >
      {src ? <img src={src} alt="" /> : HEROES[props.unit.hero].letter}
    </button>
  );
}

/** The chip's height, and its gap from the hex, in screen pixels. */
const CHIP_HEIGHT = 34;
const CHIP_GAP = 4;

/**
 * Desktop: Confirm on the board, under the hex picked last (over it on the
 * bottom row), saying when the next turn comes; "Can't do that" when the
 * rules refuse the turn.
 */
function BoardConfirm(props: {
  hex: Hex;
  boardSize: {width: number; height: number};
  text: string | null;
  onConfirm: () => void;
}) {
  const k = props.boardSize.width / SCENE_SIZE.width;
  const p = hexToPixel(props.hex, BOARD_LAYOUT);
  const below = (p.y + BOARD_LAYOUT.size) * k + CHIP_GAP;
  const top =
    below + CHIP_HEIGHT <= props.boardSize.height
      ? below
      : (p.y - BOARD_LAYOUT.size) * k - CHIP_GAP - CHIP_HEIGHT;
  const left = Math.min(Math.max(p.x * k, 64), props.boardSize.width - 64);
  return (
    <Button
      className={`${styles.seal} ${styles.boardConfirm}`}
      data-testid="board-confirm"
      fw="bold"
      size="xs"
      style={{left, top, height: CHIP_HEIGHT}}
      disabled={props.text === null}
      title="Or click the hex again, or press Enter"
      onClick={(e) => {
        // Not a click away from the board.
        e.stopPropagation();
        props.onConfirm();
      }}
    >
      {props.text === null ? 'Can’t do that' : `Confirm ${props.text}`.trim()}
    </Button>
  );
}
