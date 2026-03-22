import {useEffect, useRef, useState, useCallback} from 'react';
import {Box, Button, Overlay, Text, Stack} from '@mantine/core';
import styles from './GameCanvas.module.css';
import {
  World,
  InputSystem,
  InputFlushSystem,
  RenderSystem,
  ChildTransformSystem,
  ClickSystem,
  registerBuiltinComponents,
  loadScene,
} from '@canvas/engine';
import type {SceneData, BaseSystem, EventBus} from '@canvas/engine';

interface Props {
  sceneData: SceneData;
  systems?: BaseSystem[];
  events?: Record<string, string>;
  width?: number;
  height?: number;
  onReady?: (events: EventBus) => void;
}

export function GameCanvas({sceneData, systems, events, width = 600, height = 400, onReady}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const worldRef = useRef<World | null>(null);
  const [gameOver, setGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const [restartKey, setRestartKey] = useState(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    setGameOver(false);
    setScore(0);

    registerBuiltinComponents();

    const world = new World({canvas});
    worldRef.current = world;

    world.registerSystem(new InputSystem());
    world.registerSystem(new InputFlushSystem());
    world.registerSystem(new RenderSystem());
    world.registerSystem(new ChildTransformSystem());
    world.registerSystem(new ClickSystem());

    for (const system of systems ?? []) {
      world.registerSystem(system);
    }

    const scene = loadScene(sceneData);
    world.loadScene(scene);
    world.start();
    onReady?.(world.events);

    const {onScore, onDeath} = events ?? {};

    const unsubScore = onScore
      ? world.events.on(onScore, () => setScore((s) => s + 1))
      : undefined;

    const unsubDied = onDeath
      ? world.events.on(onDeath, () => { world.stop(); setGameOver(true); })
      : undefined;

    return () => {
      unsubScore?.();
      unsubDied?.();
      world.stop();
    };
  }, [sceneData, systems, events, restartKey]);

  const restart = useCallback(() => {
    setRestartKey((k) => k + 1);
  }, []);

  return (
    <Box pos="relative" className={styles.wrapper!}>
      <canvas ref={canvasRef} width={width} height={height} className={styles.canvas!} />
      {gameOver && (
        <Overlay color="#000" backgroundOpacity={0.7}>
          <Stack align="center" justify="center" h="100%" gap="xs">
            <Text ff="monospace" fz="2rem" fw="bold" c="white">Game Over</Text>
            {events?.onScore && <Text ff="monospace" fz="1.2rem" c="gray.4">Score: {score}</Text>}
            <Button mt={8} color="green" onClick={restart} ff="monospace" fw="bold">
              Play Again
            </Button>
          </Stack>
        </Overlay>
      )}
    </Box>
  );
}
