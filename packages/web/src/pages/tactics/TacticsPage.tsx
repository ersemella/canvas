import {useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState} from 'react';
import {Alert, Button, Center, Loader, Paper, Stack, Text} from '@mantine/core';
import {
  hexDistance,
  hexEquals,
  hexKey,
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
  RULES,
  SCENE_SIZE,
  abilitiesOf,
  actingUnit,
  allowedTargets,
  chooseAiTurn,
  mapOf,
  onMap,
  previewTurn,
  reachableHexes,
  slotsForward,
  turnCost,
  taunterOf,
  unitAt,
  unusableReason,
} from '@canvas/games-silk-road-tactics';
import type {
  AbilityDef,
  AbilityId,
  ActionTarget,
  BoardScene,
  FightState,
  HighlightKind,
  Reach,
  TacticsCardPayload,
  TacticsHoverPayload,
  TacticsTapPayload,
  TurnInput,
  Unit,
} from '@canvas/games-silk-road-tactics';
import '@fontsource/jersey-20/400.css';
import {GameCanvas} from 'components/GameCanvas';
import {GameErrorBoundary} from 'components/GameErrorBoundary';
import {useIsPhone} from 'components/useIsPhone';
import {createModuleFor, findGame} from 'registry/games';
import {runsApi} from './runsApi';
import type {RunResponse} from './runsApi';
import {HexTooltip} from './HexTooltip';
import {Glossary} from './Keywords';
import {
  AbilityDetail,
  ConfirmButton,
  HexInspector,
  PALETTE_VARS,
  RunMenu,
  StatSheet,
} from './TacticsPanels';
import styles from './TacticsPage.module.css';

/** Area abilities: their radius, to highlight the area around a chosen hex. */
const AREA_RADIUS: Partial<Record<AbilityId, number>> = {
  volley: ABILITY.volley.radius,
  freeze: ABILITY.freeze.radius,
  fog: ABILITY.fog.radius,
  hail: 0,
};

/** Why an ability has nothing to target, when that disables it. */
const NO_TARGET: Partial<Record<AbilityId, string>> = {
  bow: 'No enemy in any of the bow’s lanes.',
  sunlight: 'No ally in range to heal.',
  throw: 'No enemy next to you, or nowhere free to throw them.',
  pin: 'No enemy next to you to pin.',
  dash: 'Nowhere to dash to.',
  rampage: 'No way clear to rampage.',
};

/**
 * What the player may pick for an ability: its allowed targets (see
 * `allowedTargets`), and for one aimed at a unit only enemies, or for
 * Sunlight only allies. The rules allow friendly fire; the page doesn't
 * offer it (an area can still catch allies).
 */
function playerTargets(state: FightState, unit: Unit, def: AbilityDef): ActionTarget[] {
  const targets = allowedTargets(state, mapOf(state), unit, def);
  if (!def.targetsUnit) return targets;
  return targets.filter((t) => {
    const u = t.hex && unitAt(state, t.hex);
    return u && (def.id === 'sunlight') === (u.side === unit.side);
  });
}

/** Abilities that deal damage: aiming one shows the health of whoever it could hit. */
const isAttack = (id: AbilityId) => 'damage' in ABILITY[id] || 'damagePerSlot' in ABILITY[id];

/**
 * Silk Road Tactics: one fight against the AI (Phase 1). The run lives on
 * the server (a RunRoom); this page draws its view, previews turns with the
 * same rules locally (D11), and sends each turn as one request. Tapping or
 * hovering a hex shows what's there; Move, then a hex, plans the move;
 * an ability, then a target, previews that ability instead. Move and abilities
 * are separate actions; only Confirm commits the selected action.
 */
export function TacticsPage() {
  const [run, setRun] = useState<RunResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  /** The board is playing back what the last turn set off; the page waits for it. */
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
  /** The canvas's size on screen, to place the phone's tooltip over it. */
  const [boardSize, setBoardSize] = useState<{width: number; height: number} | null>(null);

  // A tap anywhere but the board or the side panel (on phones, the action
  // section) stops inspecting,
  // and the details go back to the unit whose turn it is. A click, not a
  // touch, so scrolling the details doesn't count. The click's path, not its
  // target: a tap can replace what it landed on (the tooltip growing).
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const path = e.composedPath();
      const inside = (el: Element | null) => el !== null && path.includes(el);
      if (inside(boardRef.current) || inside(panelRef.current)) return;
      setPinnedHex(null);
      setSelectedId(null);
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, []);

  // Phones: note the action section's height while it holds the turn's
  // choices, to keep once the fight ends.
  useLayoutEffect(() => {
    const el = actionsRef.current;
    if (el?.querySelector('[data-testid="turn-controls"]')) actionsHeight.current = el.offsetHeight;
  });

  const fight: FightState | null = run?.view.fight ?? null;
  const fightRef = useRef(fight);
  fightRef.current = fight;

  // Phones: follow the canvas's size on screen (it scales with the width).
  const hasBoard = fight !== null;
  useEffect(() => {
    const canvas = boardRef.current?.querySelector('canvas');
    if (!phone || !canvas) return;
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
      resetTurn();
      setError(null);
    },
    [resetTurn]
  );

  // Resume the key's active run, if any.
  useEffect(() => {
    runsApi
      .active()
      .then(({activeRunId}) => (activeRunId ? runsApi.get(activeRunId).then(receive) : undefined))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [receive]);

  const send = useCallback(
    async (request: () => Promise<RunResponse>) => {
      setBusy(true);
      try {
        const before = fightRef.current;
        const r = await request();
        // Play back what the action set off (the player's turn, then the AI's).
        if (before && r.view.fight.events?.length && eventsRef.current) {
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

  const startRun = useCallback(() => void send(() => runsApi.start()), [send]);

  // ── The acting unit's options ──────────────────────────────────────────────

  const acting = fight ? actingUnit(fight) : undefined;

  /** The action with its target chosen, ready to preview. */
  const action = useMemo(() => {
    if (!ability || !target) return null;
    if (ability === 'throw' && !target.to) return null;
    return {ability, target};
  }, [ability, target]);

  const reaches = useMemo(
    () => (fight && acting ? reachableHexes(fight, mapOf(fight), acting) : []),
    [fight, acting]
  );

  // Ability targets always come from the unit's current position.
  const abilityContext = useMemo(
    () => (fight && acting ? {state: fight, unit: acting} : null),
    [fight, acting]
  );

  /** What the chosen ability may target (under a binding taunt, only what affects the taunter). */
  const targets = useMemo(() => {
    if (!ability || !abilityContext || !abilityContext.unit.alive) return [];
    return playerTargets(abilityContext.state, abilityContext.unit, ABILITIES[ability]);
  }, [ability, abilityContext]);

  /**
   * What Move or the chosen ability still needs picked on the board: until
   * then the button is disabled, saying so, rather than ending the turn.
   */
  const needsTarget =
    moving && !plannedMove
      ? 'Pick where to move'
      : ability && !action
        ? ability === 'throw' && target?.hex
          ? 'Pick where to throw'
          : 'Pick a target'
        : null;

  /** There's no Hold button: with nothing picked, the button ends the turn with Hold. */
  const endsWithHold = !ability && !moving && !plannedMove;

  const input: TurnInput | null = useMemo(() => {
    if (needsTarget) return null;
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

  const commit = useCallback(
    (turn: TurnInput | null = input) => {
      if (!run || !turn) return;
      void send(() => runsApi.turn(run.runId, turn));
    },
    [run, input, send]
  );

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
      if (def.id === 'hold' || playerTargets(state, unit, def).length > 0) continue;
      const taunter = taunterOf(state, unit);
      out.set(
        def.id,
        taunter &&
          def.targets(state, map, unit, unit.hex!).length > 0 &&
          allowedTargets(state, map, unit, def).length === 0
          ? `Taunted: this can’t reach ${HEROES[taunter.hero].name}.`
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
    const slots = (hexes: number) =>
      slotsForward(turnCost(RULES.moveActionCost, hexes), acting.speed);
    if (plannedMove && plannedMove.path.length > 0) return `${slots(plannedMove.path.length)}`;
    const lengths = reaches.map((r) => r.path.length).filter((n) => n > 0);
    if (lengths.length === 0) return null;
    const low = slots(Math.min(...lengths));
    const high = slots(Math.max(...lengths));
    return low === high ? `${low}` : `${low}–${high}`;
  }, [acting, plannedMove, reaches]);

  // ── Taps on the board ──────────────────────────────────────────────────────

  const onHex = useCallback(
    (h: Hex) => {
      // A tap during a playback skips to its end.
      if (playing) {
        eventsRef.current?.emit('tactics:playback-skip', {});
        return;
      }
      if (!fight || busy) return;
      if (acting && moving) {
        const reach = reaches.find((r) => r.path.length > 0 && hexEquals(r.hex, h));
        if (reach) {
          // Tapping the chosen hex again does nothing: only Confirm commits.
          if (!plannedMove || !hexEquals(plannedMove.hex, h)) setPlannedMove(reach);
          return;
        }
      } else if (acting && ability) {
        if (ability === 'throw' && target?.hex) {
          const landing = targets.find(
            (t) => hexEquals(t.hex!, target.hex!) && hexEquals(t.to!, h)
          );
          if (landing) {
            // Tapping the chosen landing again does nothing: only Confirm commits.
            if (!target.to || !hexEquals(target.to, h)) chooseTarget(landing);
            return;
          }
        }
        const match = targets.find((t) => t.hex && hexEquals(t.hex, h));
        if (match) {
          // Tapping the chosen target again does nothing: only Confirm commits.
          const same =
            target?.hex && hexEquals(target.hex, h) && (ability !== 'throw' || target.to);
          if (!same) chooseTarget(ability === 'throw' ? {hex: h} : match);
          return;
        }
      }
      // Anything else: look at the hex, or stop looking at it if it's the one
      // being looked at (on a small phone, the board may be all there is to tap).
      if (pinnedHex && hexEquals(pinnedHex, h)) {
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
      acting,
      moving,
      reaches,
      plannedMove,
      ability,
      target,
      targets,
      chooseTarget,
      pinnedHex,
    ]
  );

  /** The phone's tooltip stops above the pinned action bar. */
  const tooltipFloor = useCallback(() => actionsRef.current?.getBoundingClientRect().top, []);

  const onHexRef = useRef(onHex);
  onHexRef.current = onHex;

  // ── What the board draws ───────────────────────────────────────────────────

  /** The hex being looked at: under the mouse, else the one last tapped. */
  const inspectHex = hover.hex ?? pinnedHex;
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
      preview: [],
      previewSlot: preview?.slot ?? null,
      aimSlot: preview?.aimSlot ?? null,
    };
    if (!fight) return out;
    if (!acting) return out;
    if (ability && isAttack(ability)) {
      // Every enemy, and the allies in the line of fire: those it can target
      // (the units the bow's lanes reach, a melee ability's neighbours) and
      // those the aimed attack would hurt.
      const ids = new Set(fight.units.filter((u) => u.side === 'enemy').map((u) => u.id));
      if (ABILITIES[ability].targetsUnit && abilityContext)
        for (const t of targets) {
          const u = t.hex && unitAt(abilityContext.state, t.hex);
          if (u) ids.add(u.id);
        }
      for (const c of preview?.changes ?? []) if (c.hpAfter < c.hpBefore) ids.add(c.unitId);
      out.healthUnitIds = [...ids];
    }
    if (moving) {
      // Like an ability's targets: every reachable hex stays open to pick,
      // the planned one chosen and the steps on the way to it marked.
      const onPath = (h: Hex) => plannedMove?.path.some((p) => hexEquals(p, h));
      for (const r of reaches)
        if (r.path.length > 0 && !onPath(r.hex)) highlights.push({hex: r.hex, kind: 'target'});
      if (plannedMove) {
        for (const h of plannedMove.path.slice(0, -1)) highlights.push({hex: h, kind: 'path'});
        highlights.push({hex: plannedMove.hex, kind: 'chosen'});
        if (acting.hex) out.path = [acting.hex, ...plannedMove.path];
      }
    } else if (ability) {
      // Only what it may target; once Throw's target is picked, where it can land.
      const shown = new Set<string>();
      const throwing = ability === 'throw' && target?.hex;
      for (const t of targets) {
        const h = throwing ? (hexEquals(t.hex!, target!.hex!) ? t.to : undefined) : t.hex;
        if (!h || shown.has(hexKey(h))) continue;
        shown.add(hexKey(h));
        highlights.push({hex: h, kind: 'target'});
      }
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
    ability,
    action,
    reaches,
    targets,
    target,
    preview,
    abilityContext,
  ]);

  useEffect(() => {
    eventsRef.current?.emit('tactics:board', scene);
  }, [scene, worldReady]);

  // ── The canvas ─────────────────────────────────────────────────────────────

  const game = useMemo(() => {
    registerBuiltinSystems();
    registerBuiltinComponents();
    const definition = findGame('silk-road-tactics')!;
    const module = createModuleFor(definition);
    module.register();
    return {sceneData: module.getSceneData(), createSystems: () => module.getSystems()};
  }, []);

  const onReady = useCallback((events: EventBus) => {
    eventsRef.current = events;
    events.on<TacticsTapPayload>('tactics:tap', ({hex}) => onHexRef.current(hex));
    events.on<TacticsCardPayload>('tactics:card', ({unitId}) => setSelectedId(unitId));
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
      /** The chosen ability's targets and the acting unit's moves, since starts are random. */
      targets,
      reaches,
      autoTurn: () => {
        if (!fight || !acting) return false;
        commit(chooseAiTurn(fight, acting));
        return true;
      },
    };
  }, [run, busy, playing, fight, acting, commit, targets, reaches]);

  // ── Layout ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <Center h="100dvh">
        <Loader size="sm" />
      </Center>
    );
  }

  if (!run || !fight || run.status === 'abandoned') {
    return (
      <Stack className={styles.page!} style={PALETTE_VARS} align="center" py="xl" gap="lg" px="md">
        <Paper className={styles.plaque!} p="xl" maw={520}>
          <Stack gap="md">
            <Text>
              Three heroes of the steppe — a Bökh Champion, a Mangudai Outrider and a Yadachy Storm
              Caller — meet a rival band on the Salt Flats Crossing. Every unit's stats are shown;
              only what the enemy will choose is hidden.
            </Text>
            <Text c="dimmed" fz="sm">
              Prototype: one fight. Hero numbers are placeholders.
            </Text>
            <Button className={styles.seal!} fw="bold" onClick={startRun} loading={busy}>
              Start a fight
            </Button>
            {error && <Text c="var(--c-madderLight)">{error}</Text>}
          </Stack>
        </Paper>
      </Stack>
    );
  }

  // The result waits for the playback to show how the fight ended.
  const finished = (fight.phase === 'won' || fight.phase === 'lost') && !playing;
  const selected =
    fight.units.find((u) => u.id === (hover.unitId ?? selectedId ?? acting?.id)) ?? null;

  // The action section (the turn) and the detail section
  // (what's tapped or hovered). Phones show the details in a tooltip over
  // the board and pin the actions to the bottom of the screen.
  const menu = <RunMenu busy={busy || playing} onReset={startRun} />;
  // Once the fight is over, New fight takes Confirm's place, and the section
  // keeps its height so the board doesn't move.
  const actions = finished ? (
    <div className={styles.confirmRow}>
      <Button size="lg" className={styles.seal!} fw="bold" onClick={startRun} loading={busy}>
        New fight
      </Button>
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
        onMove={toggleMove}
        onAbility={chooseAbility}
        menu={menu}
      >
        <ConfirmButton
          endTurn={endsWithHold}
          needsTarget={needsTarget}
          fight={fight}
          preview={preview}
          busy={busy || playing}
          onConfirm={() => commit()}
        />
      </TurnControls>
    )
  );
  // Phones: the details are a tooltip over the board, beside the tapped hex
  // (or the unit whose track card was tapped); none while a turn plays back.
  const tooltipHex =
    pinnedHex ?? (selectedId ? fight.units.find((u) => u.id === selectedId)?.hex : null) ?? null;
  const tooltip = phone && tooltipHex && boardSize && !playing && !finished && (
    <HexTooltip
      key={hexKey(tooltipHex)}
      fight={fight}
      hex={tooltipHex}
      boardSize={boardSize}
      floor={tooltipFloor}
    />
  );
  const details = inspectHex ? (
    <HexInspector fight={fight} hex={inspectHex} />
  ) : (
    selected && (
      <Glossary>
        <StatSheet fight={fight} unit={selected} />
      </Glossary>
    )
  );
  // Desktop: the chosen ability explained, under the details.
  const chosen = acting && ability && (
    <Glossary>
      <Paper className={styles.plaque!} p="sm" data-testid="chosen-ability">
        <AbilityDetail unit={acting} def={ABILITIES[ability]} />
      </Paper>
    </Glossary>
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
                    {fight.phase === 'won'
                      ? 'The rival band is scattered.'
                      : 'Your caravan has fallen.'}
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
              {chosen}
            </>
          )}
        </div>
      </div>
    </Stack>
  );
}

/**
 * The turn's choices, the same on phones and desktop: Move and the
 * abilities as big buttons (the name, then the cost in slots), in rows of
 * two, or three for a hero with more to choose from; then Confirm, filling
 * its row beside the run's menu.
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
  onMove: () => void;
  onAbility: (id: AbilityId | null) => void;
  /** The run's menu, beside the Confirm button. */
  menu: React.ReactNode;
  children?: React.ReactNode;
}) {
  const {unit, ability, plannedMove, moving} = props;
  // No Hold button: Confirm reads End turn with no action picked.
  const defs = abilitiesOf(unit).filter((def) => def.id !== 'hold');
  const label = (name: string, cost: string, note?: string) => (
    <span className={styles.bigButton}>
      <span>
        <span className={styles.tileName}>{name}</span>
        {note && <span className={styles.tileNote}> {note}</span>}
      </span>
      <span className={styles.bigButtonCost}>{cost}</span>
    </span>
  );
  return (
    <Stack gap={8} data-testid="turn-controls">
      {/* One choice per turn: Move or an ability, picked like any other. */}
      <div
        className={styles.abilityGrid}
        style={{gridTemplateColumns: `repeat(${defs.length + 1 > 4 ? 3 : 2}, 1fr)`}}
      >
        <Button
          size="lg"
          className={styles.tile!}
          disabled={!props.canMove}
          aria-pressed={moving || plannedMove !== null}
          title={
            plannedMove
              ? 'Tap to undo the move'
              : props.canMove
                ? 'Move instead of using an ability; units block the path'
                : 'Can’t move now'
          }
          onClick={props.onMove}
        >
          {label('Move', props.moveSlots !== null ? `+${props.moveSlots}` : '')}
        </Button>
        {defs.map((def) => {
          const reason =
            unusableReason(unit, def) ??
            (ability !== def.id ? (props.outOfReach.get(def.id) ?? null) : null);
          const lockedUlt =
            def.ultimate && !unit.ultimateUsed && unit.ultimateCharge < RULES.ultimateCharge;
          return (
            <Button
              key={def.id}
              size="lg"
              className={`${styles.tile} ${def.ultimate ? styles.tileUltimate : ''}`}
              disabled={reason !== null}
              aria-pressed={ability === def.id}
              title={reason ?? def.summary(unit)}
              onClick={() => props.onAbility(ability === def.id ? null : def.id)}
            >
              {/* Its own cost in slots; Confirm adds any yielding. */}
              {label(
                def.name,
                `+${props.slotsLater(def.cost)}`,
                lockedUlt ? `${unit.ultimateCharge}/${RULES.ultimateCharge}` : undefined
              )}
            </Button>
          );
        })}
      </div>
      <div className={styles.confirmRow}>
        {props.children}
        {props.menu}
      </div>
    </Stack>
  );
}
