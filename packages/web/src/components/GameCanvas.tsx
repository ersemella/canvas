import {useEffect, useRef, useState, useCallback} from 'react';
import {Box, Button, Overlay, Text, Stack} from '@mantine/core';
import styles from './GameCanvas.module.css';
import {
  World,
  InputSystem,
  InputFlushSystem,
  RenderSystem,
  ChildTransformSystem,
  registerBuiltinComponents,
  loadScene,
} from '@canvas/engine';
import type {SceneData, BaseSystem, EventBus} from '@canvas/engine';

interface Props {
  sceneData: SceneData;
  /**
   * Builds the game's systems. Called once per World — on mount, on Play
   * Again, and on React StrictMode's dev remount — because systems keep
   * per-world state (entity refs, subscriptions) and must not be shared.
   */
  createSystems?: (() => BaseSystem[]) | undefined;
  events?: Record<string, string>;
  width?: number;
  height?: number;
  onReady?: (events: EventBus) => void;
  /** localStorage key for this game's best score; omit to not track one. */
  bestScoreKey?: string | undefined;
}

function readBest(key: string | undefined): number {
  if (!key) return 0;
  try {
    return Number(localStorage.getItem(key)) || 0;
  } catch {
    return 0; // storage blocked (private mode, sandboxed iframe)
  }
}

function writeBest(key: string, value: number): void {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    // best score just won't persist
  }
}

export function GameCanvas({sceneData, createSystems, events, width = 600, height = 400, onReady, bestScoreKey}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const worldRef = useRef<World | null>(null);
  const [outcome, setOutcome] = useState<'lost' | 'won' | null>(null);
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(() => readBest(bestScoreKey));
  const [newBest, setNewBest] = useState(false);

  // Record a new best when a scored game ends.
  useEffect(() => {
    if (!outcome || !events?.onScore || !bestScoreKey) return;
    if (score > best) {
      writeBest(bestScoreKey, score);
      setBest(score);
      setNewBest(true);
    }
  }, [outcome, score, best, events, bestScoreKey]);
  const [restartKey, setRestartKey] = useState(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    setOutcome(null);
    setNewBest(false);
    setScore(0);

    registerBuiltinComponents();

    const world = new World({canvas});
    worldRef.current = world;

    world.registerSystem(new InputSystem());
    world.registerSystem(new InputFlushSystem());
    world.registerSystem(new RenderSystem());
    world.registerSystem(new ChildTransformSystem());

    for (const system of createSystems?.() ?? []) {
      world.registerSystem(system);
    }

    const scene = loadScene(sceneData);
    world.loadScene(scene);
    world.start();
    onReady?.(world.events);
    // Lets the e2e suites (scripts/e2e) inspect game state. Dev server only.
    if (import.meta.env.DEV) (window as unknown as {__canvasWorld?: World}).__canvasWorld = world;

    const {onScore, onDeath, onWin} = events ?? {};

    const unsubScore = onScore
      ? world.events.on(onScore, () => setScore((s) => s + 1))
      : undefined;

    const unsubDied = onDeath
      ? world.events.on(onDeath, () => { world.stop(); setOutcome('lost'); })
      : undefined;

    const unsubWon = onWin
      ? world.events.on(onWin, () => { world.stop(); setOutcome('won'); })
      : undefined;

    return () => {
      unsubScore?.();
      unsubDied?.();
      unsubWon?.();
      world.stop();
    };
  }, [sceneData, createSystems, events, restartKey]);

  const restart = useCallback(() => {
    setRestartKey((k) => k + 1);
  }, []);

  return (
    <Box pos="relative" className={styles.wrapper!}>
      <canvas ref={canvasRef} width={width} height={height} className={styles.canvas!} />
      {events?.onScore && !outcome && (
        <Text className={styles.score!} ff="monospace" fw="bold" c="white">
          Score: {score}
          {bestScoreKey && best > 0 ? `  ·  Best: ${Math.max(best, score)}` : ''}
        </Text>
      )}
      {outcome && (
        <Overlay color="#000" backgroundOpacity={0.7}>
          <Stack align="center" justify="center" h="100%" gap="xs">
            <Text ff="monospace" fz="2rem" fw="bold" c={outcome === 'won' ? 'green.4' : 'white'}>
              {outcome === 'won' ? 'You win!' : 'Game Over'}
            </Text>
            {events?.onScore && <Text ff="monospace" fz="1.2rem" c="gray.4">Score: {score}</Text>}
            {events?.onScore && bestScoreKey && (
              <Text ff="monospace" fz="1rem" c={newBest ? 'yellow.4' : 'gray.5'}>
                {newBest ? 'New best!' : `Best: ${best}`}
              </Text>
            )}
            <Button mt={8} color="green" onClick={restart} ff="monospace" fw="bold">
              Play Again
            </Button>
          </Stack>
        </Overlay>
      )}
    </Box>
  );
}
