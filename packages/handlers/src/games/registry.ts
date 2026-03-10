import type {ServerGameModule} from './ServerGameModule';
import {pokerServerConfig} from '@canvas/games-poker/server';

export const gameRegistry = new Map<string, ServerGameModule>([
  [pokerServerConfig.gameType, pokerServerConfig as ServerGameModule],
]);
