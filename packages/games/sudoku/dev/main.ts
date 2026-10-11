// Standalone dev page: `pnpm dev` in this package runs the game against the
// engine alone, no web shell or Worker.
import {runGame} from '@canvas/engine';
import game from '../src/index';

const canvas = document.querySelector<HTMLCanvasElement>('#game')!;
const status = document.querySelector<HTMLElement>('#status')!;
const world = runGame(game, canvas);

const {onWin, onDeath, onScore} = game.manifest.events ?? {};
let score = 0;
if (onScore) world.events.on(onScore, () => (status.textContent = `Score: ${++score}`));
if (onWin) world.events.on(onWin, () => (status.textContent = 'You win! Reload to play again.'));
if (onDeath) world.events.on(onDeath, () => {
  world.stop();
  status.textContent = 'Game over. Reload to play again.';
});
