/**
 * The games this platform builds in — the only place that names them. Order
 * is the order of the home page's game cards. Each entry is a game package's
 * `GameDefinition` (manifest + `register()`); multiplayer games also list
 * their server rules in `packages/server/src/games/registry.ts`.
 */
import type {GameDefinition} from '@canvas/engine';
import snake from '@canvas/games-snake';
import solitaire from '@canvas/games-solitaire';
import sudoku from '@canvas/games-sudoku';
import blackjack from '@canvas/games-blackjack';
import poker from '@canvas/games-poker';

export const PLATFORM_GAMES: readonly GameDefinition[] = [snake, solitaire, sudoku, blackjack, poker];
