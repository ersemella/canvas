import type {ServerSystem} from './ServerGameModule';
import {pokerServerSystem} from '@canvas/games-poker/server';

export const serverSystemRegistry = new Map<string, ServerSystem>([
  [pokerServerSystem.systemName, pokerServerSystem as ServerSystem],
]);
