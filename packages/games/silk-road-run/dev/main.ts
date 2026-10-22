// Standalone dev page: `pnpm dev` in this package runs the game against the
// engine alone, no web shell or Worker.
import {runGame} from '@canvas/engine';
import game from '../src/index';

runGame(game, document.querySelector<HTMLCanvasElement>('#game')!);
