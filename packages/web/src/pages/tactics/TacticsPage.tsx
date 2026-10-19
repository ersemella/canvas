import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {Alert, Button, Center, Group, Loader, Paper, Stack, Text} from '@mantine/core';
import {hexDistance, hexEquals, hexKey, hexToPixel, hexesInRange, registerBuiltinComponents, registerBuiltinSystems} from '@canvas/engine';
import type {EventBus, Hex} from '@canvas/engine';
import {
  ABILITIES,
  ABILITY,
  BOARD_LAYOUT,
  RULES,
  SALT_FLATS,
  SCENE_SIZE,
  abilitiesOf,
  actingUnit,
  afterAction,
  arrowLanes,
  chooseAiTurn,
  cloneFight,
  defaultDeployment,
  enterHex,
  mapOf,
  previewTurn,
  reachableHexes,
  slotsForward,
  turnCost,
  unitAt,
  unusableReason,
} from '@canvas/games-silk-road-tactics';
import type {
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
import {GameCanvas} from 'components/GameCanvas';
import {GameErrorBoundary} from 'components/GameErrorBoundary';
import {usePageHeader} from 'components/PageHeader';
import {useIsPhone} from 'components/useIsPhone';
import {createModuleFor, findGame} from 'registry/games';
import {runsApi} from './runsApi';
import type {RunResponse} from './runsApi';
import {ConfirmButton, HexInspector, StatSheet} from './TacticsPanels';
import styles from './TacticsPage.module.css';

/** Area abilities: their radius, to highlight the area around a chosen hex. */
const AREA_RADIUS: Partial<Record<AbilityId, number>> = {
  volley: ABILITY.volley.radius,
  freeze: ABILITY.freeze.radius,
  hail: 0,
};

/**
 * Silk Road Tactics: one fight against the AI (Phase 1). The run lives on
 * the server (a RunRoom); this page draws its view, previews turns with the
 * same rules locally (D11), and sends each turn as one request. Tapping or
 * hovering a hex shows what's there; Move, then a hex, plans the move;
 * an ability, then a target, previews the action; tap the target again
 * (or Confirm) to commit. Move after the action is picked to act first,
 * then move (brief section 2: one move, before or after, not split); the
 * turn panel numbers the steps, the board marks where each happens, and
 * Swap order flips them when the other order is legal too.
 */
export function TacticsPage() {
  const [run, setRun] = useState<RunResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [plannedMove, setPlannedMove] = useState<Reach | null>(null);
  const [ability, setAbility] = useState<AbilityId | null>(null);
  const [target, setTarget] = useState<ActionTarget | null>(null);
  const [deployAt, setDeployAt] = useState<Record<string, Hex>>({});
  /** Picking where to move: taps on reachable hexes plan the move; otherwise taps inspect. */
  const [moving, setMoving] = useState(false);
  /** The planned move comes after the action. */
  const [actFirst, setActFirst] = useState(false);
  /** The hex last tapped to inspect (touch can't hover). */
  const [pinnedHex, setPinnedHex] = useState<Hex | null>(null);
  const [hover, setHover] = useState<TacticsHoverPayload>({hex: null, unitId: null});
  /** Phone widths (the CSS breakpoint): a pared-down action section pinned below the details. */
  /** Phone widths: layout only (the board edge to edge, details first, actions pinned below). */
  const phone = useIsPhone();
  usePageHeader('Silk Road Tactics');
  const eventsRef = useRef<EventBus | null>(null);
  const boardRef = useRef<HTMLDivElement | null>(null);
  const actionsRef = useRef<HTMLElement | null>(null);
  const [worldReady, setWorldReady] = useState(0);

  // A tap anywhere but the board or the action section stops inspecting,
  // and the details go back to the unit whose turn it is. A click, not a
  // touch, so scrolling the details doesn't count.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const t = e.target as Node;
      if (boardRef.current?.contains(t) || actionsRef.current?.contains(t)) return;
      setPinnedHex(null);
      setSelectedId(null);
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, []);

  const fight: FightState | null = run?.view.fight ?? null;
  const map = SALT_FLATS;

  const resetTurn = useCallback(() => {
    setPlannedMove(null);
    setAbility(null);
    setTarget(null);
    setMoving(false);
    setActFirst(false);
  }, []);

  const receive = useCallback(
    (r: RunResponse) => {
      setRun(r);
      resetTurn();
      setError(null);
      if (r.view.fight.phase === 'deploy') {
        setDeployAt(Object.fromEntries(defaultDeployment(r.view.fight).map((d) => [d.unitId, d.hex])));
      }
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
        receive(await request());
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

  /** Acting first: the fight after the action, where the move starts from. */
  const acted = useMemo(
    () => (fight && acting && actFirst && action ? afterAction(fight, acting.id, action) : null),
    [fight, acting, actFirst, action]
  );

  const reaches = useMemo(() => {
    if (!fight || !acting) return [];
    if (actFirst) return acted?.unit.alive ? reachableHexes(acted.state, mapOf(acted.state), acted.unit) : [];
    return reachableHexes(fight, mapOf(fight), acting);
  }, [fight, acting, actFirst, acted]);

  /** Where the action is taken from: after the planned move, unless acting first. */
  const moved = useMemo(() => {
    if (!fight || !acting) return null;
    const state = cloneFight(fight);
    const unit = state.units.find((u) => u.id === acting.id)!;
    if (!actFirst) {
      for (const h of plannedMove?.path ?? []) enterHex({state, map: mapOf(state), slot: state.currentSlot}, unit, h);
    }
    return {state, unit};
  }, [fight, acting, plannedMove, actFirst]);

  const targets = useMemo(() => {
    if (!ability || !moved || !moved.unit.alive) return [];
    return ABILITIES[ability].targets(moved.state, mapOf(moved.state), moved.unit, moved.unit.hex!);
  }, [ability, moved]);

  /**
   * There's no Hold button: with no action picked, the button ends the turn
   * with Hold (after the move, if one is planned).
   */
  const endsWithHold = !ability;

  const input: TurnInput | null = useMemo(() => {
    const chosen = action ?? (endsWithHold ? {ability: 'hold' as const, target: {}} : null);
    if (!chosen) return null;
    const out: TurnInput = {action: chosen};
    if (plannedMove && plannedMove.path.length > 0) {
      out.move = plannedMove.path;
      if (actFirst) out.actFirst = true;
    }
    return out;
  }, [action, endsWithHold, plannedMove, actFirst]);

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
    setActFirst(false);
    setMoving(false);
  }, []);

  /** A new action, or none: a move planned after the old one no longer follows from it. */
  const chooseAbility = useCallback(
    (id: AbilityId | null) => {
      if (actFirst) clearMove();
      setAbility(id);
      setMoving(false);
      if (!id) return setTarget(null);
      // Abilities with no target (Hold, Sunlight) preview at once.
      const own = moved ? ABILITIES[id].targets(moved.state, mapOf(moved.state), moved.unit, moved.unit.hex!) : [];
      setTarget(own.length === 1 && own[0]!.hex === undefined ? {} : null);
    },
    [moved, actFirst, clearMove]
  );

  const chooseTarget = useCallback(
    (t: ActionTarget) => {
      if (actFirst) clearMove();
      setTarget(t);
    },
    [actFirst, clearMove]
  );

  /**
   * The Move toggle. On: pick a hex, before the action, or after it once one
   * is chosen with its target. Off again: undo the planned move.
   */
  const toggleMove = useCallback(() => {
    if (plannedMove) {
      // A target picked from the moved-to hex no longer holds; a targetless action (Hold) does.
      if (!actFirst && target?.hex) setTarget(null);
      return clearMove();
    }
    if (moving) return setMoving(false);
    setActFirst(action !== null);
    setMoving(true);
  }, [moving, plannedMove, actFirst, action, target, clearMove]);

  /**
   * Slots from now to the next turn after an action of `actionCost` and the
   * planned move: the placement formula, then yielding past taken slots (3.3).
   */
  const slotsLater = useCallback(
    (actionCost: number) => {
      if (!fight || !acting) return 0;
      const taken = new Set(fight.units.filter((u) => u.alive && u !== acting && u.slot !== null).map((u) => u.slot));
      let slot = fight.currentSlot + slotsForward(turnCost(actionCost, plannedMove?.path.length ?? 0), acting.speed);
      while (taken.has(slot)) slot++;
      return slot - fight.currentSlot;
    },
    [fight, acting, plannedMove]
  );

  /** Abilities aimed at a unit (melee, the bow) with no unit to aim at from where the action is taken: disabled. */
  const outOfReach = useMemo(() => {
    const out = new Set<AbilityId>();
    if (!acting || !moved?.unit.alive) return out;
    for (const def of abilitiesOf(acting)) {
      if (def.targetsUnit && def.targets(moved.state, mapOf(moved.state), moved.unit, moved.unit.hex!).length === 0) out.add(def.id);
    }
    return out;
  }, [acting, moved]);

  /**
   * The slots the planned move adds to the turn, with the chosen action (or
   * Hold, which ends a turn with no action): its own cost in slots.
   */
  const moveSlots = useMemo(() => {
    if (!acting || !plannedMove || plannedMove.path.length === 0) return null;
    const cost = ABILITIES[ability ?? 'hold'].cost;
    return slotsForward(turnCost(cost, plannedMove.path.length), acting.speed) - slotsForward(cost, acting.speed);
  }, [acting, plannedMove, ability]);

  /** The same turn in the other order, if it's legal: Swap order offers it. */
  const canSwap = useMemo(() => {
    if (!fight || !acting || !input?.move || endsWithHold) return false;
    const other: TurnInput = {action: input.action, move: input.move};
    if (!input.actFirst) other.actFirst = true;
    return previewTurn(fight, acting.id, other) !== null;
  }, [fight, acting, input, endsWithHold]);

  // ── Taps on the board ──────────────────────────────────────────────────────

  const onHex = useCallback(
    (h: Hex) => {
      if (!fight || busy) return;
      if (fight.phase === 'deploy') {
        const here = Object.entries(deployAt).find(([, at]) => hexEquals(at, h))?.[0];
        const sel = selectedId && deployAt[selectedId] ? selectedId : null;
        if (here && here !== sel) {
          if (sel) setDeployAt({...deployAt, [sel]: h, [here]: deployAt[sel]!});
          else setSelectedId(here);
          return;
        }
        const inZone = map.deployment.player.some((z) => hexEquals(z, h)) && !map.tiles[hexKey(h)];
        if (sel && inZone) setDeployAt({...deployAt, [sel]: h});
        else setSelectedId(unitAt(fight, h)?.id ?? null);
        return;
      }
      if (acting && moving) {
        const reach = reaches.find((r) => hexEquals(r.hex, h));
        if (reach) {
          setPlannedMove(reach.path.length > 0 ? reach : null);
          if (reach.path.length === 0) setActFirst(false);
          // Moving first changes where the action is taken from.
          else if (!actFirst) setTarget(ability && targets.length === 1 && targets[0]!.hex === undefined ? {} : null);
          setMoving(false);
          return;
        }
      } else if (acting && ability) {
        if (ability === 'throw' && target?.hex) {
          const landing = targets.find((t) => hexEquals(t.hex!, target.hex!) && hexEquals(t.to!, h));
          if (landing) {
            // Tapping the chosen landing again does nothing: only Confirm commits.
            if (!target.to || !hexEquals(target.to, h)) chooseTarget(landing);
            return;
          }
        }
        const match = targets.find((t) => t.hex && hexEquals(t.hex, h));
        if (match) {
          // Tapping the chosen target again does nothing: only Confirm commits.
          const same = target?.hex && hexEquals(target.hex, h) && (ability !== 'throw' || target.to);
          if (!same) chooseTarget(ability === 'throw' ? {hex: h} : match);
          return;
        }
      }
      // Anything else: look at the hex.
      setPinnedHex(h);
      setSelectedId(unitAt(fight, h)?.id ?? null);
    },
    [fight, busy, deployAt, selectedId, acting, moving, reaches, actFirst, ability, target, targets, chooseTarget, map]
  );

  const onHexRef = useRef(onHex);
  onHexRef.current = onHex;

  // ── What the board draws ───────────────────────────────────────────────────

  /** The hex being looked at: under the mouse, else the one last tapped. */
  const inspectHex = hover.hex ?? pinnedHex;
  const inspectedUnit = fight && inspectHex && fight.phase !== 'deploy' ? unitAt(fight, inspectHex) : undefined;
  /** Where the inspected unit could move this turn, if it isn't the acting one. */
  const inspectReach = useMemo(
    () =>
      fight && inspectedUnit && inspectedUnit.id !== acting?.id
        ? reachableHexes(fight, mapOf(fight), inspectedUnit).filter((r) => r.path.length > 0)
        : [],
    [fight, inspectedUnit, acting]
  );

  /** The bow's six lanes from where the archer will stand, hit or not. */
  const lanes = useMemo(
    () => (ability === 'bow' && moved?.unit.alive ? arrowLanes(moved.state, mapOf(moved.state), moved.unit.hex!) : []),
    [ability, moved]
  );

  const scene: BoardScene = useMemo(() => {
    const highlights: {hex: Hex; kind: HighlightKind}[] = [];
    const out: BoardScene = {
      fight,
      highlights,
      selectedUnitId: selectedId ?? acting?.id ?? null,
      preview: [],
      previewSlot: preview?.slot ?? null,
    };
    if (!fight) return out;
    if (fight.phase === 'deploy') {
      for (const h of map.deployment.player) if (!map.tiles[hexKey(h)]) highlights.push({hex: h, kind: 'zone'});
      out.positions = deployAt;
      return out;
    }
    for (const r of inspectReach) highlights.push({hex: r.hex, kind: 'inspect'});
    if (!acting) return out;
    for (const h of plannedMove?.path ?? []) highlights.push({hex: h, kind: 'path'});
    const onPath = (h: Hex) => plannedMove?.path.some((p) => hexEquals(p, h));
    if (moving) {
      for (const r of reaches) if (r.path.length > 0 && !onPath(r.hex)) highlights.push({hex: r.hex, kind: 'move'});
    } else if (ability) {
      if (lanes.length > 0) {
        out.arrows = [];
        for (const lane of lanes) {
          const last = lane.hexes[lane.hexes.length - 1];
          if (!last) continue;
          out.arrows.push({from: moved!.unit.hex!, to: last, hits: Boolean(lane.hit)});
          for (const h of lane.hit ? lane.hexes.slice(0, -1) : lane.hexes) highlights.push({hex: h, kind: 'lane'});
        }
      }
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
          for (const h of hexesInRange(target.hex, radius)) if (hexDistance(h, target.hex) <= radius) highlights.push({hex: h, kind: 'area'});
        }
        highlights.push({hex: target.hex, kind: 'chosen'});
        if (target.to) highlights.push({hex: target.to, kind: 'chosen'});
      }
    }
    // Numbered badges where each step happens, in the order they resolve.
    const actionHex = target?.hex ?? (actFirst || !plannedMove ? acting.hex : plannedMove.hex);
    const stepHexes = [plannedMove && !moving ? plannedMove.hex : null, action && actionHex ? actionHex : null];
    if (actFirst) stepHexes.reverse();
    out.steps = stepHexes.filter((h): h is Hex => h !== null).map((hex, i) => ({hex, n: i + 1}));
    if (preview) {
      out.preview = preview.changes.map((c) => ({unitId: c.unitId, to: c.to, hpAfter: c.hpAfter, hpBefore: c.hpBefore, killed: c.killed}));
    } else if (plannedMove && !actFirst) {
      out.preview = [{unitId: acting.id, to: plannedMove.hex, hpAfter: acting.hp, hpBefore: acting.hp, killed: false}];
    }
    return out;
  }, [fight, selectedId, acting, deployAt, plannedMove, actFirst, moving, ability, action, reaches, targets, target, preview, map, inspectReach, lanes, moved]);

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
    setWorldReady((n) => n + 1);
  }, []);

  // Dev-server hooks for the e2e suite (scripts/e2e/tactics.e2e.mjs).
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    (window as unknown as {__tactics?: unknown}).__tactics = {
      run,
      busy,
      hexToCanvas: (h: Hex) => hexToPixel(h, BOARD_LAYOUT),
      autoTurn: () => {
        if (!fight || !acting) return false;
        commit(chooseAiTurn(fight, acting));
        return true;
      },
    };
  }, [run, busy, fight, acting, commit]);

  // ── Layout ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <Center h="calc(100vh - 56px)">
        <Loader size="sm" />
      </Center>
    );
  }

  if (!run || !fight || run.status === 'abandoned') {
    return (
      <Stack align="center" py="xl" gap="lg" px="md">
        <Paper bg="dark.7" withBorder p="xl" radius="md" maw={520}>
          <Stack gap="md">
            <Text>
              Three heroes of the steppe — a Bökh Champion, a Mangudai Outrider and a Yadachy Storm Caller — meet a rival
              band on the Salt Flats Crossing. Every unit's stats are shown; only what the enemy will choose is hidden.
            </Text>
            <Text c="dimmed" fz="sm">
              Prototype: one fight. Hero numbers are placeholders.
            </Text>
            <Button color="yellow" c="dark.9" fw="bold" onClick={startRun} loading={busy}>
              Start a fight
            </Button>
            {error && <Text c="red.4">{error}</Text>}
          </Stack>
        </Paper>
      </Stack>
    );
  }

  const finished = fight.phase === 'won' || fight.phase === 'lost';
  const selected = fight.units.find((u) => u.id === (hover.unitId ?? selectedId ?? acting?.id)) ?? null;

  // The action section (deployment or the turn) and the detail section
  // (what's tapped or hovered). Phones put details first under the board and
  // pin the actions to the bottom of the screen.
  const actions = fight.phase === 'deploy' ? (
    <Paper bg="dark.7" p="sm" radius="md">
      <Stack gap="xs">
        <Text fw={600}>Deploy your heroes</Text>
        <Text fz="sm" c="dimmed">
          Tap a hero, then a hex in the blue zone, to move it. The enemy's band is already in place.
        </Text>
        <Button
          color="yellow"
          c="dark.9"
          fw="bold"
          loading={busy}
          onClick={() =>
            void send(() =>
              runsApi.deploy(run.runId, {
                placements: Object.entries(deployAt).map(([unitId, hex]) => ({unitId, hex})),
              })
            )
          }
        >
          Start the fight
        </Button>
      </Stack>
    </Paper>
  ) : (
    acting &&
    !finished && (
      <TurnControls
        phone={phone}
        slotsLater={slotsLater}
        moveSlots={moveSlots}
        outOfReach={outOfReach}
        unit={acting}
        ability={ability}
        plannedMove={plannedMove}
        actFirst={actFirst}
        canSwap={canSwap}
        onSwap={() => setActFirst(!actFirst)}
        moving={moving}
        canMove={reaches.some((r) => r.path.length > 0) || plannedMove !== null}
        onMove={toggleMove}
        onAbility={chooseAbility}
      >
        <ConfirmButton
          endTurn={endsWithHold}
          fight={fight}
          preview={preview}
          needsTarget={!input}
          busy={busy}
          onConfirm={() => commit()}
        />
      </TurnControls>
    )
  );
  const details = inspectHex ? (
    <HexInspector fight={fight} hex={inspectHex} positions={fight.phase === 'deploy' ? deployAt : undefined} />
  ) : (
    selected && <StatSheet fight={fight} unit={selected} />
  );

  return (
    <Stack align="center" pt={phone ? 0 : 'md'} pb="md" gap="sm" px="md">
      <div className={styles.layout}>
        <div className={styles.board} ref={boardRef}>
          <GameErrorBoundary>
            <GameCanvas
              sceneData={game.sceneData}
              createSystems={game.createSystems}
              width={SCENE_SIZE.width}
              height={SCENE_SIZE.height}
              onReady={onReady}
            />
          </GameErrorBoundary>
          {finished && (
            <Paper className={styles.result!} p="lg" radius="md">
              <Stack align="center" gap="xs">
                <Text fz="1.8rem" fw="bold" c={fight.phase === 'won' ? 'green.4' : 'red.4'}>
                  {fight.phase === 'won' ? 'Victory' : 'Defeat'}
                </Text>
                <Text c="dimmed" fz="sm">
                  {fight.phase === 'won' ? 'The rival band is scattered.' : 'Your caravan has fallen.'}
                </Text>
                <Button color="yellow" c="dark.9" fw="bold" onClick={startRun} loading={busy}>
                  New fight
                </Button>
              </Stack>
            </Paper>
          )}
        </div>
        <div className={styles.panel}>
          {error && (
            <Alert color="red" py={6} withCloseButton onClose={() => setError(null)}>
              {error}
            </Alert>
          )}
          {phone ? (
            <>
              <section className={styles.details} aria-label="Details">
                {details}
              </section>
              {actions && (
                <section className={styles.actionBar} ref={actionsRef}>
                  {actions}
                </section>
              )}
            </>
          ) : (
            <>
              {actions}
              {details}
            </>
          )}
        </div>
      </div>
    </Stack>
  );
}

function TurnControls(props: {
  /** Phones: smaller buttons, inline steps, no panel of its own (the pinned action bar is one). */
  phone: boolean;
  /** How many slots after now the next turn comes for an action of this cost, with the planned move. */
  slotsLater: (actionCost: number) => number;
  /** What the planned move adds, in slots, shown in the Move button. */
  moveSlots: number | null;
  /** Unit-aimed abilities with no one to aim at, disabled (unless already chosen, so they can be put down). */
  outOfReach: Set<AbilityId>;
  unit: Unit;
  ability: AbilityId | null;
  plannedMove: Reach | null;
  actFirst: boolean;
  /** Both steps are planned and the turn is also legal the other way round. */
  canSwap: boolean;
  onSwap: () => void;
  moving: boolean;
  canMove: boolean;
  onMove: () => void;
  onAbility: (id: AbilityId | null) => void;
  children?: React.ReactNode;
}) {
  const {unit, ability, plannedMove, moving, phone} = props;
  // The steps in the order they resolve, named only.
  const moveStep = moving || (plannedMove?.path.length ?? 0) > 0 ? 'Move' : null;
  const actionStep = ability ? ABILITIES[ability].name : null;
  const steps = (props.actFirst ? [actionStep, moveStep] : [moveStep, actionStep]).filter((x): x is string => x !== null);
  const size = phone ? 'compact-sm' : 'xs';
  return (
    <Paper bg={phone ? 'transparent' : 'dark.7'} p={phone ? 0 : 'sm'} radius="md">
      <Stack gap={8}>
        {steps.length > 0 && (
          <Group gap="xs" justify="space-between" wrap="nowrap">
            <ol className={`${styles.steps} ${styles.stepsInline}`} data-testid="turn-steps">
              {steps.map((step, i) => (
                <li key={step}>
                  <span className={styles.stepNo}>{i + 1}</span>
                  {step}
                </li>
              ))}
            </ol>
            {props.canSwap && (
              <Button size="compact-xs" variant="light" color="gray" onClick={props.onSwap} title="Do the other step first">
                ⇅ Swap order
              </Button>
            )}
          </Group>
        )}
        <div className={styles.abilities}>
          <Button
            size={size}
            variant={moving || plannedMove ? 'filled' : 'light'}
            color="teal"
            disabled={!props.canMove}
            aria-pressed={moving || plannedMove !== null}
            title={
              plannedMove
                ? 'Tap to undo the move'
                : props.canMove
                  ? 'Move up to your movement cap, before or after the action'
                  : 'Can’t move now'
            }
            onClick={props.onMove}
          >
            Move
            {props.moveSlots !== null && <span className={styles.abilityCost}>+{props.moveSlots}</span>}
          </Button>
          {abilitiesOf(unit)
            // No Hold button: Confirm reads End turn with no action picked.
            .filter((def) => def.id !== 'hold')
            .map((def) => {
              const reason =
                unusableReason(unit, def) ??
                (props.outOfReach.has(def.id) && ability !== def.id
                  ? def.id === 'bow'
                    ? 'No one in any of the bow’s lanes.'
                    : 'No one next to you to target.'
                  : null);
              const lockedUlt = def.ultimate && !unit.ultimateUsed && unit.turnsTaken < RULES.ultimateUnlockTurns;
              return (
                <Button
                  key={def.id}
                  size={size}
                  variant={ability === def.id ? 'filled' : 'light'}
                  color={def.ultimate ? 'grape' : 'blue'}
                  disabled={reason !== null}
                  title={reason ?? def.summary}
                  onClick={() => props.onAbility(ability === def.id ? null : def.id)}
                >
                  {def.name}
                  {lockedUlt ? ` ${unit.turnsTaken}/${RULES.ultimateUnlockTurns}` : ''}
                  {/* How many slots later the next turn comes, with the planned move. */}
                  <span className={styles.abilityCost}>+{props.slotsLater(def.cost)}</span>
                </Button>
              );
            })}
        </div>
        {props.children}
      </Stack>
    </Paper>
  );
}
