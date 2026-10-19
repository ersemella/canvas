import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {Link} from 'react-router-dom';
import {Alert, Badge, Box, Button, Center, Group, Loader, Paper, Stack, Text, Title} from '@mantine/core';
import {hexDistance, hexEquals, hexKey, hexToPixel, hexesInRange, registerBuiltinComponents, registerBuiltinSystems} from '@canvas/engine';
import type {EventBus, Hex, HexGridClickPayload} from '@canvas/engine';
import {
  ABILITIES,
  ABILITY,
  BOARD_LAYOUT,
  HEROES,
  RULES,
  SALT_FLATS,
  abilitiesOf,
  actingUnit,
  chooseAiTurn,
  cloneFight,
  defaultDeployment,
  enterHex,
  mapOf,
  previewTurn,
  reachableHexes,
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
  TurnInput,
  Unit,
} from '@canvas/games-silk-road-tactics';
import {GameCanvas} from 'components/GameCanvas';
import {GameErrorBoundary} from 'components/GameErrorBoundary';
import {createModuleFor, findGame} from 'registry/games';
import {runsApi} from './runsApi';
import type {RunResponse} from './runsApi';
import {StatSheet, TrackPanel, TurnPreviewBox, FightLog} from './TacticsPanels';
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
 * same rules locally (D11), and sends each turn as one request. Tap a hex to
 * plan a move, pick an ability, tap a target to preview, tap it again (or
 * Confirm) to commit.
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
  const [confirmAbandon, setConfirmAbandon] = useState(false);
  const eventsRef = useRef<EventBus | null>(null);
  const [worldReady, setWorldReady] = useState(0);

  const fight: FightState | null = run?.view.fight ?? null;
  const map = SALT_FLATS;

  const resetTurn = useCallback(() => {
    setPlannedMove(null);
    setAbility(null);
    setTarget(null);
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
  const reaches = useMemo(() => (fight && acting ? reachableHexes(fight, mapOf(fight), acting) : []), [fight, acting]);

  /** The fight with the planned move made, to list targets from where the unit will stand. */
  const moved = useMemo(() => {
    if (!fight || !acting) return null;
    const state = cloneFight(fight);
    const unit = state.units.find((u) => u.id === acting.id)!;
    for (const h of plannedMove?.path ?? []) enterHex({state, map: mapOf(state), slot: state.currentSlot}, unit, h);
    return {state, unit};
  }, [fight, acting, plannedMove]);

  const targets = useMemo(() => {
    if (!ability || !moved || !moved.unit.alive) return [];
    return ABILITIES[ability].targets(moved.state, mapOf(moved.state), moved.unit, moved.unit.hex!);
  }, [ability, moved]);

  const input: TurnInput | null = useMemo(() => {
    if (!ability || !target) return null;
    if (ability === 'throw' && !target.to) return null;
    const out: TurnInput = {action: {ability, target}};
    if (plannedMove && plannedMove.path.length > 0) out.move = plannedMove.path;
    return out;
  }, [ability, target, plannedMove]);

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

  const chooseAbility = useCallback(
    (id: AbilityId) => {
      setAbility(id);
      // Abilities with no target (Hold, Clear the Storm) preview at once.
      const own = moved ? ABILITIES[id].targets(moved.state, mapOf(moved.state), moved.unit, moved.unit.hex!) : [];
      setTarget(own.length === 1 && own[0]!.hex === undefined ? {} : null);
    },
    [moved]
  );

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
      if (!acting) {
        setSelectedId(unitAt(fight, h)?.id ?? null);
        return;
      }
      if (ability) {
        if (ability === 'throw' && target?.hex) {
          const landing = targets.find((t) => hexEquals(t.hex!, target.hex!) && hexEquals(t.to!, h));
          if (landing) {
            if (target.to && hexEquals(target.to, h)) commit();
            else setTarget(landing);
            return;
          }
        }
        const match = targets.find((t) => t.hex && hexEquals(t.hex, h));
        if (match) {
          const same = target?.hex && hexEquals(target.hex, h) && (ability !== 'throw' || target.to);
          if (same) commit();
          else setTarget(ability === 'throw' ? {hex: h} : match);
          return;
        }
        setSelectedId(unitAt(fight, h)?.id ?? selectedId);
        return;
      }
      const reach = reaches.find((r) => hexEquals(r.hex, h));
      if (reach) {
        setPlannedMove(reach.path.length > 0 ? reach : null);
        setSelectedId(acting.id);
        return;
      }
      setSelectedId(unitAt(fight, h)?.id ?? null);
    },
    [fight, busy, deployAt, selectedId, acting, ability, target, targets, reaches, commit, map]
  );

  const onHexRef = useRef(onHex);
  onHexRef.current = onHex;

  // ── What the board draws ───────────────────────────────────────────────────

  const scene: BoardScene = useMemo(() => {
    const highlights: {hex: Hex; kind: HighlightKind}[] = [];
    const out: BoardScene = {fight, highlights, selectedUnitId: selectedId ?? acting?.id ?? null, preview: []};
    if (!fight) return out;
    if (fight.phase === 'deploy') {
      for (const h of map.deployment.player) if (!map.tiles[hexKey(h)]) highlights.push({hex: h, kind: 'zone'});
      out.positions = deployAt;
      return out;
    }
    if (!acting) return out;
    for (const h of plannedMove?.path ?? []) highlights.push({hex: h, kind: 'path'});
    if (!ability) {
      for (const r of reaches) if (r.path.length > 0 && !plannedMove?.path.some((p) => hexEquals(p, r.hex))) highlights.push({hex: r.hex, kind: 'move'});
    } else {
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
    } else if (plannedMove) {
      out.preview = [{unitId: acting.id, to: plannedMove.hex, hpAfter: acting.hp, hpBefore: acting.hp, killed: false}];
    }
    return out;
  }, [fight, selectedId, acting, deployAt, plannedMove, ability, reaches, targets, target, preview, map]);

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
    events.on<HexGridClickPayload>('hexgrid:click', ({hex}) => onHexRef.current(hex));
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
  const selected = fight.units.find((u) => u.id === (selectedId ?? acting?.id)) ?? null;

  return (
    <Stack align="center" py="md" gap="sm" px="md">
      {header}
      <div className={styles.layout}>
        <div className={styles.board}>
          <GameErrorBoundary>
            <GameCanvas sceneData={game.sceneData} createSystems={game.createSystems} width={600} height={400} onReady={onReady} />
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
                onAbility={chooseAbility}
                onClearMove={() => {
                  setPlannedMove(null);
                  setTarget(null);
                }}
                onCancel={() => {
                  setAbility(null);
                  setTarget(null);
                }}
              >
                {ability && (
                  <TurnPreviewBox
                    fight={fight}
                    actingId={acting.id}
                    ability={ability}
                    preview={preview}
                    needsTarget={!input}
                    busy={busy}
                    onConfirm={() => commit()}
                  />
                )}
              </TurnControls>
            )
          )}
          {fight.phase === 'fight' && (
            <Button
              size="compact-xs"
              variant="subtle"
              color={confirmAbandon ? 'red' : 'gray'}
              onClick={() => {
                if (!confirmAbandon) return setConfirmAbandon(true);
                setConfirmAbandon(false);
                startRun();
              }}
              onBlur={() => setConfirmAbandon(false)}
            >
              {confirmAbandon ? 'Tap again: abandon (counts as a defeat) and start over' : 'Abandon run'}
            </Button>
          )}
          {fight.phase !== 'deploy' && (
            <TrackPanel fight={fight} previewSlot={preview?.slot ?? null} actingId={acting?.id ?? null} onSelect={setSelectedId} />
          )}
          {selected && <StatSheet fight={fight} unit={selected} />}
          <FightLog fight={fight} />
        </div>
      </div>
    </Stack>
  );
}

function TurnControls(props: {
  unit: Unit;
  ability: AbilityId | null;
  plannedMove: Reach | null;
  onAbility: (id: AbilityId) => void;
  onClearMove: () => void;
  onCancel: () => void;
  children?: React.ReactNode;
}) {
  const {unit, ability, plannedMove} = props;
  const hexes = plannedMove?.path.length ?? 0;
  return (
    <Paper bg="dark.7" p="sm" radius="md">
      <Stack gap={6}>
        <Group justify="space-between">
          <Text fw={600}>Your turn: {HEROES[unit.hero].name}</Text>
          <Badge color="yellow" variant="light">
            slot {unit.slot}
          </Badge>
        </Group>
        <Group justify="space-between">
          <Text fz="sm" c="dimmed">
            {hexes > 0
              ? `Move ${hexes} hex${hexes > 1 ? 'es' : ''} (+${hexes * RULES.moveCostPerHex} cost)`
              : ability
                ? 'No move'
                : 'Tap a hex to move (optional), then pick an action.'}
          </Text>
          {hexes > 0 && (
            <Button size="compact-xs" variant="subtle" color="gray" onClick={props.onClearMove}>
              Stay
            </Button>
          )}
        </Group>
        <div className={styles.abilities}>
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
                onClick={() => (ability === def.id ? props.onCancel() : props.onAbility(def.id))}
              >
                {def.name}
                {lockedUlt ? ` ${unit.turnsTaken}/${RULES.ultimateUnlockTurns}` : ''}
              </Button>
            );
          })}
        </div>
        {ability && (
          <Text fz="xs" c="dimmed">
            {ABILITIES[ability].summary} Cost {ABILITIES[ability].cost}
            {ABILITIES[ability].charged ? ` to charge, ${ABILITIES[ability].recoveryCost} to recover` : ''}.
          </Text>
        )}
        {props.children}
      </Stack>
    </Paper>
  );
}
