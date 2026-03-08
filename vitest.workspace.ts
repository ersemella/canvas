import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
  'packages/engine/vitest.config.ts',
  'packages/web/vitest.config.ts',
  'packages/games/snake/vitest.config.ts',
]);
