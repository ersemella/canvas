import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {Link} from 'react-router-dom';
import {Alert, Badge, Box, Button, Center, Group, Loader, Paper, Stack, Text, Title} from '@mantine/core';
import {hexDistance, hexEquals, hexKey, hexToPixel, hexesInRange, registerBuiltinComponents, registerBuiltinSystems} from '@canvas/engine';
import type {EventBus, Hex} from '@canvas/engine';
import {
  ABILITIES,
  ABILITY,
  BOARD_LAYOUT,
  HEROES,
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
import {createModuleFor, findGame} from 'registry/games';
import {runsApi} from './runsApi';
import type {RunResponse} from './runsApi';
import {HexInspector, StatSheet, TurnPreviewBox} from './TacticsPanels';
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
 * then move (brief section 2: one move, before or after, not split).
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
  const eventsRef = useRef<EventBus | null>(null);
  const [worldReady, setWorldReady] = useState(0);

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

  const input: TurnInput | null = useMemo(() => {
    if (!action) return null;
    const out: TurnInput = {action};
    if (plannedMove && plannedMove.path.length > 0) {
      out.move = plannedMove.path;
      if (actFirst) out.actFirst = true;
    }
    return out;
  }, [action, plannedMove, actFirst]);

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
      // Abilities with no target (Hold, Clear the Storm) preview at once.
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

  /** Move: pick a hex. Before the action, or after it once one is chosen with its target. */
  const startMove = useCallback(() => {
    if (moving) return setMoving(false);
    if (!plannedMove) setActFirst(action !== null);
    setMoving(true);
  }, [moving, plannedMove, action]);

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
            if (target.to && hexEquals(target.to, h)) commit();
            else chooseTarget(landing);
            return;
          }
        }
        const match = targets.find((t) => t.hex && hexEquals(t.hex, h));
        if (match) {
          const same = target?.hex && hexEquals(target.hex, h) && (ability !== 'throw' || target.to);
          if (same) commit();
          else chooseTarget(ability === 'throw' ? {hex: h} : match);
          return;
        }
      }
      // Anything else: look at the hex.
      setPinnedHex(h);
      setSelectedId(unitAt(fight, h)?.id ?? null);
    },
    [fight, busy, deployAt, selectedId, acting, moving, reaches, actFirst, ability, target, targets, commit, chooseTarget, map]
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
    if (preview) {
      out.preview = preview.changes.map((c) => ({unitId: c.unitId, to: c.to, hpAfter: c.hpAfter, hpBefore: c.hpBefore, killed: c.killed}));
    } else if (plannedMove && !actFirst) {
      out.preview = [{unitId: acting.id, to: plannedMove.hex, hpAfter: acting.hp, hpBefore: acting.hp, killed: false}];
    }
    return out;
  }, [fight, selectedId, acting, deployAt, plannedMove, actFirst, moving, ability, reaches, targets, target, preview, map, inspectReach, lanes, moved]);

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

  const header = (
    <Group justify="space-between" w="100%" wrap="nowrap">
      <Button component={Link} to="/" variant="subtle" color="gray" size="sm" px={4}>
        ← Home
      </Button>
      <Title order={2} fz="xl" ta="center">
        Silk Road Tactics
      </Title>
      <Box w={70} />
    </Group>
  );

  if (!run || !fight || run.status === 'abandoned') {
    return (
      <Stack align="center" py="xl" gap="lg" px="md">
        {header}
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

  return (
    <Stack align="center" py="md" gap="sm" px="md">
      {header}
      <div className={styles.layout}>
        <div className={styles.board}>
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
          {fight.phase === 'deploy' ? (
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
                unit={acting}
                ability={ability}
                plannedMove={plannedMove}
                actFirst={actFirst}
                moving={moving}
                canMove={reaches.some((r) => r.path.length > 0) || plannedMove !== null}
                onMove={startMove}
                onAbility={chooseAbility}
                onClearMove={() => {
                  if (!actFirst) setTarget(null);
                  clearMove();
                }}
              >
                {ability && (
                  <TurnPreviewBox
                    fight={fight}
                    actingId={acting.id}
                    ability={ability}
                    preview={preview}
                    cost={turnCost(ABILITIES[ability].cost, plannedMove?.path.length ?? 0)}
                    needsTarget={!input}
                    busy={busy}
                    onConfirm={() => commit()}
                  />
                )}
              </TurnControls>
            )
          )}
          {inspectHex ? (
            <HexInspector fight={fight} hex={inspectHex} positions={fight.phase === 'deploy' ? deployAt : undefined} />
          ) : (
            selected && <StatSheet fight={fight} unit={selected} />
          )}
        </div>
      </div>
    </Stack>
  );
}

function TurnControls(props: {
  unit: Unit;
  ability: AbilityId | null;
  plannedMove: Reach | null;
  actFirst: boolean;
  moving: boolean;
  canMove: boolean;
  onMove: () => void;
  onAbility: (id: AbilityId | null) => void;
  onClearMove: () => void;
  children?: React.ReactNode;
}) {
  const {unit, ability, plannedMove, moving} = props;
  const hexes = plannedMove?.path.length ?? 0;
  const moveText = hexes > 0 ? `move ${hexes} hex${hexes > 1 ? 'es' : ''}` : null;
  const actionText = ability ? ABILITIES[ability].name : null;
  const plan = moving
    ? props.actFirst
      ? `${actionText} first: tap a hex to move to after it.`
      : 'Tap a highlighted hex to move to.'
    : props.actFirst && moveText && actionText
      ? `${actionText}, then ${moveText}.`
      : moveText && actionText
        ? `M${moveText.slice(1)}, then ${actionText}.`
        : moveText
          ? `M${moveText.slice(1)}. Now pick an action.`
          : actionText
            ? `${actionText}. Pick Move before or after choosing a target.`
            : 'Tap a hex to look at it. Pick Move, an action, or both.';
  return (
    <Paper bg="dark.7" p="sm" radius="md">
      <Stack gap={6}>
        <Group justify="space-between">
          <Text fw={600}>Your turn: {HEROES[unit.hero].name}</Text>
          <Badge color="yellow" variant="light">
            slot {unit.slot}
          </Badge>
        </Group>
        <Group justify="space-between" wrap="nowrap">
          <Text fz="sm" c="dimmed">
            {plan}
          </Text>
          {hexes > 0 && !moving && (
            <Button size="compact-xs" variant="subtle" color="gray" onClick={props.onClearMove}>
              Stay
            </Button>
          )}
        </Group>
        <div className={styles.abilities}>
          <Button
            size="xs"
            variant={moving ? 'filled' : 'light'}
            color="teal"
            disabled={!props.canMove}
            title={props.canMove ? 'Move up to your movement cap, before or after the action' : 'Can’t move now'}
            onClick={props.onMove}
          >
            Move
          </Button>
          {abilitiesOf(unit).map((def) => {
            const reason = unusableReason(unit, def);
            const lockedUlt = def.ultimate && !unit.ultimateUsed && unit.turnsTaken < RULES.ultimateUnlockTurns;
            return (
              <Button
                key={def.id}
                size="xs"
                variant={ability === def.id ? 'filled' : 'light'}
                color={def.ultimate ? 'grape' : 'blue'}
                disabled={reason !== null}
                title={reason ?? def.summary}
                onClick={() => props.onAbility(ability === def.id ? null : def.id)}
              >
                {def.name}
                {lockedUlt ? ` ${unit.turnsTaken}/${RULES.ultimateUnlockTurns}` : ''}
                <span className={styles.abilityCost}>{def.cost}</span>
              </Button>
            );
          })}
        </div>
        {ability && (
          <Text fz="xs" c="dimmed">
            {ABILITIES[ability].summary}
            {ability === 'bow' ? ' Dashed lanes miss.' : ''}
          </Text>
        )}
        {props.children}
      </Stack>
    </Paper>
  );
}
