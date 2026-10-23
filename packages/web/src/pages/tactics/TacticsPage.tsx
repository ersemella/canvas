import {useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState} from 'react';
import {Alert, Button, Center, Loader, Paper, Stack, Text} from '@mantine/core';
import {
  hexEquals,
  hexKey,
  hexToPixel,
  registerBuiltinComponents,
  registerBuiltinSystems,
} from '@canvas/engine';
import type {EventBus, Hex} from '@canvas/engine';
import {
  ABILITIES,
  BOARD_LAYOUT,
  HEROES,
  SCENE_SIZE,
  atExit,
  camelOf,
  chooseAiTurn,
  hexOverlaySpan,
  mapOf,
  plainSand,
  trackCards,
  unitAt,
} from '@canvas/games-silk-road-run';
import type {
  BoardScene,
  FightState,
  TacticsCardPayload,
  TacticsHoverPayload,
  TacticsTapPayload,
  TurnInput,
} from '@canvas/games-silk-road-run';
import '@fontsource/jersey-20/400.css';
import {GameCanvas} from 'components/GameCanvas';
import {GameErrorBoundary} from 'components/GameErrorBoundary';
import {useIsPhone} from 'components/useIsPhone';
import {createModuleFor, findGame} from 'registry/games';
import {StartMenu} from './StartMenu';
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
import {BoardConfirm, TurnControls, choiceRows} from './TurnControls';
import {buildScene} from './boardScene';
import {useBoardFit} from './useBoardFit';
import {useDesktopControls} from './useDesktopControls';
import {useRun} from './useRun';
import {SKIP, useTurnPlan} from './useTurnPlan';
import styles from './TacticsPage.module.css';

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

/**
 * Silk Road Run: a run of fights against the AI. The run lives on
 * the server (a RunRoom, `useRun`); this page draws its view, previews turns with the
 * same rules locally (D11, `useTurnPlan`), and sends each turn as one request. Tapping or
 * hovering a hex shows what's there; Move, then a hex, plans the move;
 * an ability, then a target, previews that ability instead. Move and abilities
 * are separate actions; once its hex or target is picked, the picked button
 * confirms it. Skip turn ends the turn with Hold. On desktop a click on a
 * reachable hex plans a move without Move, a second click on the hex picked
 * last commits, and keys and a right-click do the rest (phase-1-brief.md).
 */
export function TacticsPage() {
  const eventsRef = useRef<EventBus | null>(null);
  const {
    run,
    fight,
    loading,
    busy,
    playing,
    error,
    setError,
    startMenu,
    setStartMenu,
    startRun,
    sendTurn,
    nextStage: goToNextStage,
    playbackDone,
    boardReady,
  } = useRun(eventsRef);

  /** The unit tapped, or whose track card was. */
  const [selectedId, setSelectedId] = useState<string | null>(null);
  /** The hex last tapped to inspect (touch can't hover). */
  const [pinnedHex, setPinnedHex] = useState<Hex | null>(null);
  const [hover, setHover] = useState<TacticsHoverPayload>({hex: null, unitId: null});
  const stopLooking = useCallback(() => {
    setPinnedHex(null);
    setSelectedId(null);
  }, []);
  /** Phone widths: layout only (the board edge to edge, details first, actions pinned below). */
  const phone = useIsPhone();
  const actionsRef = useRef<HTMLElement | null>(null);
  /** The details and actions (the whole side panel on desktop): clicks there keep the inspected hex. */
  const panelRef = useRef<HTMLDivElement | null>(null);
  /** Phones: the action section's height during the fight, kept once it ends so the board stays put. */
  const actionsHeight = useRef(0);
  const [worldReady, setWorldReady] = useState(0);

  const hasBoard =
    !loading && run !== null && fight !== null && run.status !== 'abandoned' && !startMenu;
  const {boardRef, boardSlotRef, boardSize, fitWidth} = useBoardFit(phone, hasBoard);

  const plan = useTurnPlan(fight, phone, hover.hex);
  const {acting, ability, plannedMove, moving, reaches, targets, input, preview} = plan;

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
      stopLooking();
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, [phone, boardRef, stopLooking]);

  // Phones: note the action section's tallest height while it holds the
  // turn's choices, to keep once the fight ends, so the board doesn't move.
  // (The camel's shorter turns keep it through `rows`.)
  useLayoutEffect(() => {
    const el = actionsRef.current;
    if (el?.querySelector('[data-testid="turn-controls"]'))
      actionsHeight.current = Math.max(actionsHeight.current, el.offsetHeight);
  });

  const commit = useCallback(
    (turn: TurnInput | null = input) => {
      if (turn) sendTurn(turn);
    },
    [input, sendTurn]
  );

  const nextStage = useCallback(() => {
    if (busy) return;
    stopLooking();
    goToNextStage();
  }, [busy, stopLooking, goToNextStage]);

  // ── Taps on the board ──────────────────────────────────────────────────────

  const onHex = useCallback(
    (h: Hex) => {
      // A tap during a playback skips to its end.
      if (playing) {
        eventsRef.current?.emit('tactics:playback-skip', {});
        return;
      }
      if (!fight || busy) return;
      // Desktop: a second click on the hex just picked commits the turn.
      // Phones un-pick it instead: there the board is only for looking and aiming.
      if (!phone && input && preview && plan.lastPicked && hexEquals(plan.lastPicked, h)) {
        commit();
        return;
      }
      if (plan.planTap(h)) {
        // A tap that plans the turn closes a phone's tooltip, as any tap outside it does.
        if (phone) stopLooking();
        return;
      }
      // Anything else: look at the hex, or stop looking at it if it's the one
      // being looked at (on a small phone, the board may be all there is to tap).
      // Plain sand has nothing to show: tapping it is tapping away.
      if ((pinnedHex && hexEquals(pinnedHex, h)) || plainSand(fight, mapOf(fight), h)) {
        stopLooking();
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
      input,
      preview,
      plan.lastPicked,
      plan.planTap,
      pinnedHex,
      commit,
      stopLooking,
    ]
  );

  /**
   * Desktop: Esc or a right-click steps back once: the step or landing
   * picked last, then the target or destination, then the ability or Move,
   * then whatever is being looked at.
   */
  const {stepBack: stepBackPlan} = plan;
  const stepBack = useCallback(() => {
    if (!stepBackPlan()) stopLooking();
  }, [stepBackPlan, stopLooking]);
  const confirmPicked = useCallback(() => {
    if (input && preview) commit();
  }, [input, preview, commit]);
  useDesktopControls({
    phone,
    board: boardRef,
    actions: actionsRef,
    hasBoard,
    onConfirm: confirmPicked,
    onStepBack: stepBack,
  });

  // A hex looked at that a turn left with nothing on it (its unit moved
  // away, fell or was pushed off) stops being looked at.
  useEffect(() => {
    if (fight && pinnedHex && plainSand(fight, mapOf(fight), pinnedHex)) stopLooking();
  }, [fight, pinnedHex, stopLooking]);

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

  const {target, moveMode, hoverReach, fromHere, stepOptions} = plan;
  const scene: BoardScene = useMemo(
    () =>
      buildScene({
        fight,
        acting,
        phone,
        selectedId,
        featuredId,
        hoverHex: hover.hex,
        preview,
        ability,
        target,
        targets,
        moving,
        moveMode,
        plannedMove,
        hoverReach,
        reaches,
        fromHere,
        stepOptions,
      }),
    [
      fight,
      acting,
      phone,
      selectedId,
      featuredId,
      hover.hex,
      preview,
      ability,
      target,
      targets,
      moving,
      moveMode,
      plannedMove,
      hoverReach,
      reaches,
      fromHere,
      stepOptions,
    ]
  );

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

  const onReady = useCallback(
    (events: EventBus) => {
      eventsRef.current = events;
      events.on<TacticsTapPayload>('tactics:tap', ({hex}) => onHexRef.current(hex));
      // A track card's unit, in place of any hex looked at before (which
      // would otherwise win, and may since have emptied).
      events.on<TacticsCardPayload>('tactics:card', ({unitId}) => {
        setPinnedHex(null);
        setSelectedId(unitId);
      });
      events.on<TacticsHoverPayload>('tactics:hover', setHover);
      events.on('tactics:playback-done', playbackDone);
      boardReady();
      setWorldReady((n) => n + 1);
    },
    [playbackDone, boardReady]
  );

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
      /** Every hex of plain sand now (nothing on it to explain: no unit, tile, hail or exit). */
      sandHexes: () =>
        fight ? mapOf(fight).hexes.filter((h) => plainSand(fight, mapOf(fight), h)) : [],
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
    return <StartMenu busy={busy} error={error} onStart={startRun} />;
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
  // or New run takes Confirm's place, and the section keeps its height so
  // the board doesn't move.
  const {needsTarget, skipPreview, slotsLater, outOfReach, toggleMove, chooseAbility} = plan;
  const actions = finished ? (
    <div className={styles.confirmRow}>
      {nextAhead ? (
        <Button size="lg" className={styles.seal!} fw="bold" loading={busy} onClick={nextStage}>
          Next stage
        </Button>
      ) : (
        <Button size="lg" className={styles.seal!} fw="bold" onClick={() => setStartMenu(true)}>
          New run
        </Button>
      )}
      {menu}
    </div>
  ) : (
    acting && (
      <TurnControls
        slotsLater={slotsLater}
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
        onDismiss={stopLooking}
      />
    );
  const details = inspectHex ? (
    <HexInspector fight={fight} hex={inspectHex} />
  ) : (
    selected && <StatSheet fight={fight} unit={selected} />
  );
  // Desktop: the picked turn's Confirm beside the hex picked last, so the
  // turn is confirmed where the eyes are (a second click on the hex does too).
  const {lastPicked} = plan;
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
