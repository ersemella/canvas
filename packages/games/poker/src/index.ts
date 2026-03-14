import type {GameModule, SceneData} from '@canvas/engine';
import {PokerSystem, createInitialState} from './PokerSystem';
import {PokerRendererSystem} from './PokerRendererSystem';
import {PokerSidePanel} from './PokerSidePanel';

export {PokerSystem, createInitialState} from './PokerSystem';
export {PokerRendererSystem} from './PokerRendererSystem';
export {pokerActionService} from './pokerActionService';
export type {PokerGameState, PokerUiState, PokerAction, Player, Card, LogEntry, Phase, ActionType} from './types';
export type {PublicPokerState, PublicPlayer} from './publicTypes';
export type {PokerNetworkAdapter} from './networkAdapter';
export {createMultiplayerModule} from './multiplayerModule';

const gameState = createInitialState();

export default {
  register(): void {},
  getSceneData(): SceneData {
    return {name: 'poker', entities: []};
  },
  getSystems() {
    return [new PokerSystem(gameState), new PokerRendererSystem(gameState)];
  },
  getEvents() {
    return {};
  },
  getCanvas() {
    return {width: 800, height: 580};
  },
  getSidePanel(): unknown {
    return PokerSidePanel;
  },
} satisfies GameModule;
