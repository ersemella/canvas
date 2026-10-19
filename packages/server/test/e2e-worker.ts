/**
 * Worker entry for local e2e runs only (`scripts/e2e/run.mjs` starts
 * `wrangler dev test/e2e-worker.ts`): the production Worker plus a test-only
 * async game. Production deploys `src/index.ts`, which never imports this.
 */
import worker, {GameRoom, ManifestRegistry, RunRoom, PlayerLedger} from '../src/index';
import {serverSystemRegistry} from '../src/games/registry';
import type {ServerSystem} from '../src/types';
import {asyncTestGame} from './asyncTestGame';

serverSystemRegistry.set(asyncTestGame.systemName, asyncTestGame as ServerSystem);

export {GameRoom, ManifestRegistry, RunRoom, PlayerLedger};
export default worker;
