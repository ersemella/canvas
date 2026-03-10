import {useEffect, useRef, useState, useCallback} from 'react';
import {
  World,
  InputSystem,
  InputFlushSystem,
  RendererSystem,
  RectRendererSystem,
  RenderFlushSystem,
  registerBuiltinComponents,
  loadScene,
} from '@canvas/engine';
import type {SceneData, BaseSystem, EventBus} from '@canvas/engine';
import styles from './GameCanvas.module.css';

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
    world.registerSystem(new RendererSystem());
    world.registerSystem(new RectRendererSystem());
    world.registerSystem(new RenderFlushSystem());

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
    <div className={styles.wrapper}>
      <canvas ref={canvasRef} width={width} height={height} className={styles.canvas} />
      {gameOver && (
        <div className={styles.overlay}>
          <p className={styles.gameOverTitle}>Game Over</p>
          {events?.onScore && <p className={styles.gameOverScore}>Score: {score}</p>}
          <button className={styles.restartButton} onClick={restart}>
            Play Again
          </button>
        </div>
      )}
    </div>
  );
}
