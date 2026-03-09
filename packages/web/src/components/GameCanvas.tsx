import {useEffect, useRef, useState, useCallback} from 'react';
import {
  World,
  InputSystem,
  PhysicsSystem,
  CollisionSystem,
  AnimationSystem,
  AISystem,
  ScriptSystem,
  AudioSystem,
  UISystem,
  RendererSystem,
  registerBuiltinComponents,
  loadScene,
} from '@canvas/engine';
import type {SceneData} from '@canvas/engine';
import styles from './GameCanvas.module.css';

interface Props {
  sceneData: SceneData;
  width?: number;
  height?: number;
}

export function GameCanvas({sceneData, width = 600, height = 400}: Props) {
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
    world.registerSystem(new PhysicsSystem());
    world.registerSystem(new CollisionSystem());
    world.registerSystem(new AnimationSystem());
    world.registerSystem(new AISystem());
    world.registerSystem(new ScriptSystem());
    world.registerSystem(new AudioSystem());
    world.registerSystem(new UISystem());
    world.registerSystem(new RendererSystem());

    const scene = loadScene(sceneData);
    world.loadScene(scene);
    world.start();

    const unsubScore = world.events.on('score:increment', () => {
      setScore((s) => s + 1);
    });

    const unsubDied = world.events.on('snake:died', () => {
      world.stop();
      setGameOver(true);
    });

    return () => {
      unsubScore();
      unsubDied();
      world.stop();
    };
  }, [sceneData, restartKey]);

  const restart = useCallback(() => {
    setRestartKey((k) => k + 1);
  }, []);

  return (
    <div className={styles.wrapper}>
      <canvas ref={canvasRef} width={width} height={height} className={styles.canvas} />
      {gameOver && (
        <div className={styles.overlay}>
          <p className={styles.gameOverTitle}>Game Over</p>
          <p className={styles.gameOverScore}>Score: {score}</p>
          <button className={styles.restartButton} onClick={restart}>
            Play Again
          </button>
        </div>
      )}
    </div>
  );
}
