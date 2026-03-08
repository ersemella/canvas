import React, { useEffect, useRef } from 'react';
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
import type { SceneData } from '@canvas/engine';
import styles from './GameCanvas.module.css';

interface Props {
  sceneData: SceneData;
  width?: number;
  height?: number;
}

export function GameCanvas({ sceneData, width = 600, height = 400 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    registerBuiltinComponents();

    const world = new World({ canvas });
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

    return () => {
      world.stop();
    };
  }, [sceneData]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className={styles.canvas}
    />
  );
}
