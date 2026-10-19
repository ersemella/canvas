import {World} from '../core/World';
import {InputSystem} from '../systems/InputSystem';
import {InputFlushSystem} from '../systems/InputFlushSystem';
import {RenderSystem} from '../systems/RenderSystem';
import {ChildTransformSystem} from '../systems/ChildTransformSystem';
import {registerBuiltinComponents, registerBuiltinSystems} from './ComponentLoader';
import {loadScene} from './SceneLoader';
import {createGameModule} from './GameLoader';
import type {GameDefinition} from './GameLoader';

/**
 * Runs a game on a canvas with nothing else around it: registers the
 * engine's built-ins and the game's own pieces, sizes the canvas from the
 * manifest (600×400 if it doesn't say, times its `scale`), adds the core systems, loads the scene and starts the loop.
 * For a game package's standalone dev page; the platform's web shell does
 * the same with its own overlays and score handling. Stop it with
 * `world.stop()`.
 */
export function runGame(game: GameDefinition, canvas: HTMLCanvasElement): World {
  registerBuiltinComponents();
  registerBuiltinSystems();
  const module = createGameModule(game.manifest, () => game.register?.());
  module.register();

  // Same default as the web shell when the manifest doesn't size the canvas.
  const {width, height, scale = 1, pixelArt = false} = module.getCanvas() ?? {width: 600, height: 400};
  canvas.width = width * scale;
  canvas.height = height * scale;

  const world = new World({canvas, scale, pixelArt});
  world.registerSystem(new InputSystem());
  world.registerSystem(new InputFlushSystem());
  world.registerSystem(new RenderSystem());
  world.registerSystem(new ChildTransformSystem());
  for (const system of module.getSystems()) world.registerSystem(system);

  world.loadScene(loadScene(module.getSceneData()));
  world.start();
  return world;
}
