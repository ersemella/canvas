import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
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
  RULES,
  SALT_FLATS,
  SCENE_SIZE,
  abilitiesOf,
  actingUnit,
  arrowLanes,
  chooseAiTurn,
  defaultDeployment,
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
  const [deployAt, setDeployAt] = useState<Record<string, Hex>>({});
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
  const fightRef = useRef(fight);
  fightRef.current = fight;
  const map = SALT_FLATS;

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
      if (r.view.fight.phase === 'deploy') {
        setDeployAt(
          Object.fromEntries(defaultDeployment(r.view.fight).map((d) => [d.unitId, d.hex]))
        );
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

  const targets = useMemo(() => {
    if (!ability || !abilityContext || !abilityContext.unit.alive) return [];
    return ABILITIES[ability].targets(
      abilityContext.state,
      mapOf(abilityContext.state),
      abilityContext.unit,
      abilityContext.unit.hex!
    );
  }, [ability, abilityContext]);

  /**
   * There's no Hold button: with no action picked, the button ends the turn
   * with Hold (or selects a separate move action if a path is planned).
   */
  const endsWithHold = !ability && !plannedMove;

  const input: TurnInput | null = useMemo(() => {
    const chosen = action ?? (!ability ? {ability: 'hold' as const, target: {}} : null);
    if (!chosen) return null;
    const out: TurnInput = {action: chosen};
    if (plannedMove && plannedMove.path.length > 0) {
      out.move = plannedMove.path;
    }
    return out;
  }, [action, ability, plannedMove]);

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

  /** Abilities aimed at a unit (melee, the bow) with no unit to aim at from where the action is taken: disabled. */
  const outOfReach = useMemo(() => {
    const out = new Set<AbilityId>();
    if (!acting || !abilityContext?.unit.alive) return out;
    for (const def of abilitiesOf(acting)) {
      if (
        def.targetsUnit &&
        def.targets(
          abilityContext.state,
          mapOf(abilityContext.state),
          abilityContext.unit,
          abilityContext.unit.hex!
        ).length === 0
      )
        out.add(def.id);
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
      // Anything else: look at the hex.
      setPinnedHex(h);
      setSelectedId(unitAt(fight, h)?.id ?? null);
    },
    [
      fight,
      busy,
      playing,
      deployAt,
      selectedId,
      acting,
      moving,
      reaches,
      plannedMove,
      ability,
      target,
      targets,
      chooseTarget,
      map,
    ]
  );

  const onHexRef = useRef(onHex);
  onHexRef.current = onHex;

  // ── What the board draws ───────────────────────────────────────────────────

  /** The hex being looked at: under the mouse, else the one last tapped. */
  const inspectHex = hover.hex ?? pinnedHex;
  const inspectedUnit =
    fight && inspectHex && fight.phase !== 'deploy' ? unitAt(fight, inspectHex) : undefined;
  /** Where the inspected unit could move this turn, if it isn't the acting one. */
  const inspectReach = useMemo(
    () =>
      fight && inspectedUnit && inspectedUnit.id !== acting?.id
        ? reachableHexes(fight, mapOf(fight), inspectedUnit).filter((r) => r.path.length > 0)
        : [],
    [fight, inspectedUnit, acting]
  );

  /**
   * On a phone, the unit the details feature (the one on the inspected hex,
   * else the tapped or acting one) shows its health and statuses on the board.
   */
  const featuredId = phone
    ? ((inspectHex ? inspectedUnit?.id : (selectedId ?? acting?.id)) ?? null)
    : null;

  /** The bow's six lanes from where the archer will stand, hit or not. */
  const lanes = useMemo(
    () =>
      ability === 'bow' && abilityContext?.unit.alive
        ? arrowLanes(abilityContext.state, mapOf(abilityContext.state), abilityContext.unit.hex!)
        : [],
    [ability, abilityContext]
  );

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
    if (fight.phase === 'deploy') {
      for (const h of map.deployment.player)
        if (!map.tiles[hexKey(h)]) highlights.push({hex: h, kind: 'zone'});
      out.positions = deployAt;
      return out;
    }
    for (const r of inspectReach) highlights.push({hex: r.hex, kind: 'inspect'});
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
      }
    } else if (ability) {
      if (lanes.length > 0) {
        out.arrows = [];
        for (const lane of lanes) {
          const last = lane.hexes[lane.hexes.length - 1];
          if (!last) continue;
          out.arrows.push({from: abilityContext!.unit.hex!, to: last, hits: Boolean(lane.hit)});
          for (const h of lane.hit ? lane.hexes.slice(0, -1) : lane.hexes)
            highlights.push({hex: h, kind: 'lane'});
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
          for (const h of hexesInRange(target.hex, radius))
            if (hexDistance(h, target.hex) <= radius) highlights.push({hex: h, kind: 'area'});
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
    deployAt,
    plannedMove,
    moving,
    ability,
    action,
    reaches,
    targets,
    target,
    preview,
    map,
    inspectReach,
    lanes,
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
      autoTurn: () => {
        if (!fight || !acting) return false;
        commit(chooseAiTurn(fight, acting));
        return true;
      },
    };
  }, [run, busy, playing, fight, acting, commit]);

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
              Three heroes of the steppe — a Bökh Champion, a Mangudai Outrider and a Yadachy Storm
              Caller — meet a rival band on the Salt Flats Crossing. Every unit's stats are shown;
              only what the enemy will choose is hidden.
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

  // The result waits for the playback to show how the fight ended.
  const finished = (fight.phase === 'won' || fight.phase === 'lost') && !playing;
  const selected =
    fight.units.find((u) => u.id === (hover.unitId ?? selectedId ?? acting?.id)) ?? null;

  // The action section (deployment or the turn) and the detail section
  // (what's tapped or hovered). Phones put details first under the board and
  // pin the actions to the bottom of the screen.
  const actions =
    fight.phase === 'deploy' ? (
      <Paper bg="dark.7" p="sm" radius="md">
        <Stack gap="xs">
          <Text fw={600}>Deploy your heroes</Text>
          <Text fz="sm" c="dimmed">
            Tap a hero, then a hex in the blue zone, to move it. The enemy's band is already in
            place.
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
            busy={busy || playing}
            onConfirm={() => commit()}
          />
        </TurnControls>
      )
    );
  const details = inspectHex ? (
    <HexInspector
      fight={fight}
      hex={inspectHex}
      positions={fight.phase === 'deploy' ? deployAt : undefined}
    />
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
                  {fight.phase === 'won'
                    ? 'The rival band is scattered.'
                    : 'Your caravan has fallen.'}
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
  /** Phones: smaller buttons, no panel of its own (the pinned action bar is one). */
  phone: boolean;
  /** What an ability of this cost takes in slots, before yielding. */
  slotsLater: (actionCost: number) => number;
  /** The move action's cost in slots (a range until a hex is picked), shown in the Move button. */
  moveSlots: string | null;
  /** Unit-aimed abilities with no one to aim at, disabled (unless already chosen, so they can be put down). */
  outOfReach: Set<AbilityId>;
  unit: Unit;
  ability: AbilityId | null;
  plannedMove: Reach | null;
  moving: boolean;
  canMove: boolean;
  onMove: () => void;
  onAbility: (id: AbilityId | null) => void;
  children?: React.ReactNode;
}) {
  const {unit, ability, plannedMove, moving, phone} = props;
  const size = phone ? 'compact-sm' : 'xs';
  return (
    <Paper bg={phone ? 'transparent' : 'dark.7'} p={phone ? 0 : 'sm'} radius="md">
      <Stack gap={8}>
        {/* One choice per turn: Move or an ability, picked like any other. */}
        <div className={styles.abilities}>
          <Button
            size={size}
            variant={moving || plannedMove ? 'filled' : 'light'}
            color="blue"
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
            Move
            {props.moveSlots !== null && (
              <span className={styles.abilityCost}>+{props.moveSlots}</span>
            )}
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
              const lockedUlt =
                def.ultimate && !unit.ultimateUsed && unit.turnsTaken < RULES.ultimateUnlockTurns;
              return (
                <Button
                  key={def.id}
                  size={size}
                  variant={ability === def.id ? 'filled' : 'light'}
                  color={def.ultimate ? 'grape' : 'blue'}
                  disabled={reason !== null}
                  aria-pressed={ability === def.id}
                  title={reason ?? def.summary(unit)}
                  onClick={() => props.onAbility(ability === def.id ? null : def.id)}
                >
                  {def.name}
                  {lockedUlt ? ` ${unit.turnsTaken}/${RULES.ultimateUnlockTurns}` : ''}
                  {/* Its own cost in slots; Confirm adds any yielding. */}
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
